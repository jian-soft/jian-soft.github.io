---
title: Linux内核网络源码走读之Netfilter
---

本文走读内核网络之Netfilter子系统相关的源码。源码基于kernel 4.14版本。

Netfilter子系统包含数据包选择、过滤、修改，连接跟踪，网络地址转换(NAT)等内容。

## Netfilter挂载点

在上篇[《Linux内核源码走读之IPv4及IPv6》](/2022/05/06/learn_linux_netlink.html)文章中，我们在IPv4和IPv6的接收和发送路径中，看到过这些挂载点。

- **NF_INET_PRE_ROUTING**: 在IPv4中，这个挂载点位于方法ip_rcv()中。这是所有入站数据包遇到的第一个挂载点，它处在路由选择之前。

- **NF_INET_LOCAL_IN**: 在IPv4中，这个挂载点位于方法ip_local_deliver中。对于所有发给当前主机的入站数据包，经过挂载点NF_INET_PRE_ROUTING和路由选择子系统之后，都将到达这个挂载点。

- **NF_INET_FORWARD**: 在IPv4中，这个挂载点位于方法ip_forward()中。对于所有要转发的数据包，经过挂载点NF_INET_PRE_ROUTING和路由选择子系统之后，都将到达这个挂载点。

- **NF_INET_POST_ROUTING**: 在IPv4中，这个挂载点位于方法ip_output()中。所有要转发的数据包，都在经过挂载点NF_INET_FORWARD后到达这个挂载点。另外，当前主机生成的数据包经过挂载点NF_INET_LOCAL_OUT后将到达这个挂载点。

- **NF_INET_LOCAL_OUT**: 在IPv4中，这个挂载点位于方法__ip_local_out中。当前主机生成的所有出站数据包都在经过路由查找和此挂载点之后，到达挂载点NF_INET_POST_ROUTING。

内核网络代码中，一般通过宏NF_HOOK来调用在挂载点中注册的钩子函数。
```c
static inline int
NF_HOOK(uint8_t pf, unsigned int hook, struct net *net, struct sock *sk, struct sk_buff *skb,
    struct net_device *in, struct net_device *out,
    int (*okfn)(struct net *, struct sock *, struct sk_buff *))
{
    int ret = nf_hook(pf, hook, net, sk, skb, in, out, okfn);
    if (ret == 1)
        ret = okfn(net, sk, skb);
    return ret;
}

//nf_hook并不调用okfn回调函数，NF_HOOK宏判断nf_hook返回值=1(表示允许包通过)调用okfn
static inline int nf_hook(u_int8_t pf, unsigned int hook, struct net *net,
              struct sock *sk, struct sk_buff *skb,
              struct net_device *indev, struct net_device *outdev,
              int (*okfn)(struct net *, struct sock *, struct sk_buff *))
    switch (pf)
    case NFPROTO_IPV4:
        hook_head = rcu_dereference(net->nf.hooks_ipv4[hook]);

    struct nf_hook_state state;
    nf_hook_state_init(&state, hook, pf, indev, outdev, sk, net, okfn);
    ret = nf_hook_slow(skb, &state, hook_head, 0);
    return ret

int nf_hook_slow(struct sk_buff *skb, struct nf_hook_state *state,
         const struct nf_hook_entries *e, unsigned int s)
    for (; s < e->num_hook_entries; s++)
        //依次执行注册的hook函数，如果返回值是NF_ACCEPT，则表示调用者可进一步执行okfn
        verdict = nf_hook_entry_hookfn(&e->hooks[s], skb, state);
            return entry->hook(entry->priv, skb, state);
```

Netfilter钩子回调函数返回值必须是下述五个值之一，这些值被称为netfilter verdicts(netfilter判决)

- NF_DROP: 默默丢弃数据包
- NF_ACCEPT: 数据包继续在内核协议栈中传输
- NF_STOLEN: 数据包不继续传输，由钩子方法进行处理
- NF_QUEUE: 将数据包排序，供用户空间使用
- NF_REPEAT: 再次调用钩子函数

### 注册Netfilter钩子回调函数

注册Netfilter钩子回调函数的方法有两个nf_register_net_hook和nf_register_net_hooks。
4.13之前的内核版本还有两个注册接口nf_register_hook和nf_register_hooks，
从4.13版本开始内核删除了这两个接口，这两个接口最终也是调用nf_register_net_hook，下面看下nf_register_net_hook:
```c
int nf_register_net_hook(struct net *net, const struct nf_hook_ops *reg)
    __nf_register_net_hook(net, reg->pf, reg)
        struct nf_hook_entries *p, *new_hooks;
        struct nf_hook_entries __rcu **pp;
        pp = nf_hook_entry_head(net, pf, reg->hooknum, reg->dev)
            return net->nf.hooks_ipv4 + hooknum; //以pf==NFPROTO_IPV4为例。钩子挂载点保存在struct net对象中
        p = nf_entry_dereference(*pp);
        new_hooks = nf_hook_entries_grow(p, reg); //将新的nf_hook_ops按照优先级插入到hook entries中
```

我们看到nf_register_net_hook一个入参是结构体struct nf_hook_ops，看下这个结构体：
```c
typedef unsigned int nf_hookfn(void *priv,
                   struct sk_buff *skb,
                   const struct nf_hook_state *state);

struct nf_hook_ops {
    /* User fills in from here down. */
    nf_hookfn       *hook; //要注册的钩子回调函数
    struct net_device   *dev;
    void            *priv;
    u_int8_t        pf; //协议簇，对于IPv4来说，它为NFPROTO_IPV4; IPV6, NFPROTO_IPV6
    bool            nat_hook;
    unsigned int        hooknum; //netfilter的5个挂载点之一
    /* Hooks are ordered in ascending priority. */
    int         priority; //按优先级升序排列回调函数，priority值越小回调函数越先被调用
};
```

## 连接跟踪

现代网络中，仅根据L4和L3报头来过滤流量还不够，还应考虑基于会话对包进行处理。
连接跟踪能够让内核跟踪会话，连接跟踪的主要目标是为NAT打下基础。

### 连接跟踪初始化

先看下连接跟踪模块定义的netfilter挂载点对象数组，即结构体struct nf_hook_ops数组，定义在netfilter各挂载点的处理函数。
```c
static const struct nf_hook_ops ipv4_conntrack_ops[] = {
    {
        .hook       = ipv4_conntrack_in,
        .pf     = NFPROTO_IPV4,
        .hooknum    = NF_INET_PRE_ROUTING,
        .priority   = NF_IP_PRI_CONNTRACK,
    },
    {
        .hook       = ipv4_conntrack_local,
        .pf     = NFPROTO_IPV4,
        .hooknum    = NF_INET_LOCAL_OUT,
        .priority   = NF_IP_PRI_CONNTRACK,
    },
    {
        .hook       = ipv4_helper,
        .pf     = NFPROTO_IPV4,
        .hooknum    = NF_INET_POST_ROUTING,
        .priority   = NF_IP_PRI_CONNTRACK_HELPER,
    },
    {
        .hook       = ipv4_confirm,
        .pf     = NFPROTO_IPV4,
        .hooknum    = NF_INET_POST_ROUTING,
        .priority   = NF_IP_PRI_CONNTRACK_CONFIRM,
    },
    {
        .hook       = ipv4_helper,
        .pf     = NFPROTO_IPV4,
        .hooknum    = NF_INET_LOCAL_IN,
        .priority   = NF_IP_PRI_CONNTRACK_HELPER,
    },
    {
        .hook       = ipv4_confirm,
        .pf     = NFPROTO_IPV4,
        .hooknum    = NF_INET_LOCAL_IN,
        .priority   = NF_IP_PRI_CONNTRACK_CONFIRM,
    },
};
```
注册的最重要的连接跟踪回调函数是，NF_INET_PRE_ROUTING钩子回调函数ipv4_conntrack_in和NF_INET_LOCAL_OUT钩子回调函数ipv4_conntrack_local。
这两个钩子函数的优先级为NF_IP_PRI_CONNTRACK(-200)，优先级较高。
ipv4_conntrack_in和ipv4_conntrack_local都会调用到nf_conntrack_in，下一小结走读nf_conntrack_in。

继续看下注册这个ipv4_conntrack_ops的地方。在内核版本4.9及以前，直接在函数nf_conntrack_l3proto_ipv4_init中调用nf_register_hooks来注册。
4.10及以后内核，不在nf_conntrack_l3proto_ipv4_init中直接注册ipv4_conntrack_ops，看下相关代码：
```c
//nf_conntrack_l3proto_ipv4.c
//nf_conntrack_l3proto_ipv4_init为nf_conntrack_ipv4.ko的初始化函数
module_init(nf_conntrack_l3proto_ipv4_init);


static int __init nf_conntrack_l3proto_ipv4_init(void)
    ...
    ret = nf_ct_l3proto_register(&nf_conntrack_l3proto_ipv4);
        rcu_assign_pointer(nf_ct_l3protos[proto->l3proto], proto); //注册到全局变量nf_ct_l3protos中


struct nf_conntrack_l3proto nf_conntrack_l3proto_ipv4 __read_mostly = {
    .l3proto     = PF_INET,
    .pkt_to_tuple    = ipv4_pkt_to_tuple,
    .invert_tuple    = ipv4_invert_tuple,
    .get_l4proto     = ipv4_get_l4proto,
#if IS_ENABLED(CONFIG_NF_CT_NETLINK)
    .tuple_to_nlattr = ipv4_tuple_to_nlattr,
    .nlattr_to_tuple = ipv4_nlattr_to_tuple,
    .nla_policy  = ipv4_nla_policy,
    .nla_size    = NLA_ALIGN(NLA_HDRLEN + sizeof(u32)) + /* CTA_IP_V4_SRC */
               NLA_ALIGN(NLA_HDRLEN + sizeof(u32)),  /* CTA_IP_V4_DST */
#endif
    .net_ns_get  = ipv4_hooks_register, //这里注册的函数用于注册连接跟踪的netfliter钩子
    .net_ns_put  = ipv4_hooks_unregister,
    .me      = THIS_MODULE,
};

//先看下ipv4_hooks_register
static int ipv4_hooks_register(struct net *net)
    struct conntrack4_net *cnet = net_generic(net, conntrack4_net_id);
    cnet->users++;
    if (cnet->users > 1)
        goto out_unlock; //只在第一次调用的时候往下走，之后的调用只是users技术+1
    //注册连接跟踪的netfilter钩子
    nf_register_net_hooks(net, ipv4_conntrack_ops, ARRAY_SIZE(ipv4_conntrack_ops));

//再看下调用nf_conntrack_l3proto_ipv4.net_ns_get的地方
int nf_ct_netns_get(struct net *net, u8 nfproto)
    if (nfproto == NFPROTO_INET)
        nf_ct_netns_do_get(net, NFPROTO_IPV4)
        nf_ct_netns_do_get(net, NFPROTO_IPV6)

static int nf_ct_netns_do_get(struct net *net, u8 nfproto)
    const struct nf_conntrack_l3proto *l3proto;
    l3proto = __nf_ct_l3proto_find(nfproto); //对于NFPROTO_IPV4，这里返回的是nf_conntrack_l3proto_ipv4
    l3proto->net_ns_get(net); //调用net_ns_get

//调用nf_ct_netns_get地方有很多，主要应该是通过nft_ct_get_init和nft_nat_init
```


下图展示了IPv4连接跟踪钩子函数在IPv4收发流程中的位置，其中绿色方块是netfilter的5个钩子挂载点，蓝色方块是连接跟踪模块注册的钩子函数:
![ipv4_conntrack_hooks.png](/assets/image/2022/08/ipv4_conntrack_hooks.png)

用来区分特定方向上的流的结构体是struct nf_conntrack_tuple：
```c
struct nf_conntrack_tuple {
    struct nf_conntrack_man src;  //tuple的可操作部分

    /* 以下是tuple的固定部分 */
    struct {
        union nf_inet_addr u3;
        union {
            /* Add other protocols here. */
            __be16 all;
            struct {
                __be16 port;
            } tcp;
            struct {
                __be16 port;
            } udp;
            struct {
                u_int8_t type, code;
            } icmp;
            struct {
                __be16 port;
            } dccp;
            struct {
                __be16 port;
            } sctp;
            struct {
                __be16 key;
            } gre;
        } u;
        u_int8_t protonum; //protocol
        u_int8_t dir;
    } dst;
};
```

### 连接跟踪条目

struct nf_conn表示连接跟踪条目，即保存到连接跟踪hash表里的节点。
```c
struct nf_conn {
    struct nf_conntrack ct_general;
    spinlock_t  lock;
    u16     cpu;
    struct nf_conntrack_zone zone;
    struct nf_conntrack_tuple_hash tuplehash[IP_CT_DIR_MAX]; //hashlist节点
    unsigned long status;
    u32 timeout;

    possible_net_t ct_net;
    struct hlist_node   nat_bysource;
    /* all members below initialized via memset */
    struct { } __nfct_init_offset;
    struct nf_conn *master;
    u_int32_t mark;
    u_int32_t secmark;
    struct nf_ct_ext *ext;
    union nf_conntrack_proto proto;
};
```

接下来看一下方法nf_conntrack_in():
```c
unsigned int nf_conntrack_in(struct net *net, u_int8_t pf, unsigned int hooknum, struct sk_buff *skb)
    l3proto = __nf_ct_l3proto_find(pf);  //对于pf=PF_INET,PF_INET,返回的是全局变量nf_conntrack_l3proto_ipv4
    l3proto->get_l4proto(skb, skb_network_offset(skb), &dataoff, &protonum); //.get_l4proto=ipv4_get_l4proto
        //对于IPv4 ->get_l4proto=ipv4_get_l4proto
        *dataoff = nhoff + (iph->ihl << 2);
        *protonum = iph->protocol; //protonum即四层协议
    l4proto = __nf_ct_l4proto_find(pf, protonum); //以IPPROTO_TCP为例，返回的是全局变量nf_conntrack_l4proto_tcp4

    resolve_normal_ct(net, tmpl, skb, dataoff, pf, protonum, l3proto, l4proto);
        struct nf_conntrack_tuple tuple;
        struct nf_conntrack_tuple_hash *h;
        nf_ct_get_tuple() //填充tuple
        hash = hash_conntrack_raw(&tuple, net); //对tuple进行hash散列运算，调用的内核提供的jhash2()
        h = __nf_conntrack_find_get(net, zone, &tuple, hash); //在全局变量nf_conntrack_hash hash表下查找连接是否存在
        if (!h) //如果连接不存在，则新建一个连接，保存到unconfirmed list
            h = init_conntrack(net, tmpl, &tuple, l3proto, l4proto,skb, dataoff, hash);
        ct = nf_ct_tuplehash_to_ctrack(h); //利用container_of得到真正的连接对象
        ...//一系列ctinfo赋值逻辑，对于新建的连接ctinfo = IP_CT_NEW
        nf_ct_set(skb, ct, ctinfo); //将连接对象和连接状态值，保存到skb中
            skb->_nfct = (unsigned long)ct | info; //借助指针低4位一定为0的逻辑，低4位存整数值
    timeouts = nf_ct_timeout_lookup(net, ct, l4proto);
    l4proto->packet(ct, skb, dataoff, ctinfo, pf, timeouts); //以TCP为例，->packet==tcp_packet()

```

再看下ipv4_confirm()的代码：
```c
ipv4_confirm
    nf_conntrack_confirm

static inline int nf_conntrack_confirm(struct sk_buff *skb)
    ct = nf_ct_get(skb, &ctinfo);
    ...
    nf_ct_del_from_dying_or_unconfirmed_list(ct); //从unconfirmed或dying表中删除连接
    ...
    __nf_conntrack_hash_insert(ct, hash, reply_hash); //插入到nf_conntrack_hash
    ...
```

## iptables

iptables由内核部分和用户空间部分组成，核心是内核部分。

iptables的字面意思就是ip表项，每个表由struct xt_table表示。IPv4中，注册和注销表的接口是ipt_register_table()和ipt_unregister_table()。
```c
struct xt_table {
    struct list_head list;
    /* What hooks you will enter on */
    unsigned int valid_hooks;
    /* Man behind the curtain... */
    struct xt_table_info *private; //
    struct module *me;
    u_int8_t af;        /* address/protocol family */
    int priority;       /* hook order */
    /* called when table is needed in the given netns */
    int (*table_init)(struct net *net);
    const char name[XT_TABLE_MAXNAMELEN];
};

int ipt_register_table(struct net *net, const struct xt_table *table,
               const struct ipt_replace *repl,
               const struct nf_hook_ops *ops, struct xt_table **res)
    xt_register_table(net, table, &bootstrap, newinfo);
        list_add(&table->list, &net->xt.tables[table->af]); //注册到net->xt.tables上
    nf_register_net_hooks(net, ops, hweight32(table->valid_hooks)) //注册netfilter钩子
```

struct net对象包含IPv4和IPv6专用对象netns_ipv4和netns_ipv6，netns_ipv4和netns_ipv6又包含指向xt_table对象的指针。
例如netns_ipv4包含iptable_filter、iptable_mangle、iptable_raw、arptable_filter、nat_table。

我们以iptable_filter过滤表为例，来进一步看下iptables的工作原理。
```c
//filter表的定义
#define FILTER_VALID_HOOKS ((1 << NF_INET_LOCAL_IN) | \
                (1 << NF_INET_FORWARD) | \
                (1 << NF_INET_LOCAL_OUT))
static const struct xt_table packet_filter = {
    .name       = "filter",
    .valid_hooks    = FILTER_VALID_HOOKS, //按照FILTER_VALID_HOOKS定义，在netfilter的3个挂载点挂载钩子
    .me     = THIS_MODULE,
    .af     = NFPROTO_IPV4,
    .priority   = NF_IP_PRI_FILTER,
    .table_init = iptable_filter_table_init,
};

//初始化
static int __init iptable_filter_init(void)
    //这一步主要是初始化netfilter钩子挂载对象，3个挂载点的回调函数都是iptable_filter_hook
    filter_ops = xt_hook_ops_alloc(&packet_filter, iptable_filter_hook);
    register_pernet_subsys(&iptable_filter_net_ops)
        iptable_filter_net_init
            iptable_filter_table_init(net)
                //注册filter表
                ipt_register_table(net, &packet_filter, repl, filter_ops,
                 &net->ipv4.iptable_filter);
```
总结下，内核提供了一些表，表里的条目由用户空间程序设置。

看一个用户空间iptables命令例子:
```c
iptables -A INPUT -p udp --dport=5001 -j LOG --log-level 1
```
这条规则的意思是，向filter表中添加一条规则，将目标端口为5001的UDP入站数据包转储到系统日志中。
使用iptables命令时，应使用修饰符-t来指定要使用的表，如果没指定，默认使用过滤表。

再看一个规则：
```c
iptables -A INPUT -p tcp -m conntrack --ctstate ESTABLISHED -j LOG --log-level 1
```
这个规则是根据连接跟踪状态来过滤数据包，将连接状态为ESTABLISHED的数据包转储到系统日志中。

**本文主要聚焦内核源码，关于用户空间的iptables命令，后面另起文章学习**

## NAT

NAT(Network Address Translation)网络地址转换，主要用于IP地址转换或端口转换。
NAT最常见的用途之一是，让局域网中一组使用私有IP地址的主机能够通过网关的公网IP访问Internet。

### NAT初始化

与上节介绍的过滤表一样，NAT表也是一个xt_table对象。
```c
static const struct xt_table nf_nat_ipv4_table = {
    .name       = "nat",
    .valid_hooks    = (1 << NF_INET_PRE_ROUTING) |
              (1 << NF_INET_POST_ROUTING) |
              (1 << NF_INET_LOCAL_OUT) |
              (1 << NF_INET_LOCAL_IN),
    .me     = THIS_MODULE,
    .af     = NFPROTO_IPV4,
    .table_init = iptable_nat_table_init,
};
```
nat表的netfilter钩子函数：
```c
static const struct nf_hook_ops nf_nat_ipv4_ops[] = {
    /* Before packet filtering, change destination */
    {
        .hook       = iptable_nat_ipv4_in,
        .pf     = NFPROTO_IPV4,
        .nat_hook   = true,
        .hooknum    = NF_INET_PRE_ROUTING,
        .priority   = NF_IP_PRI_NAT_DST,
    },
    /* After packet filtering, change source */
    {
        .hook       = iptable_nat_ipv4_out,
        .pf     = NFPROTO_IPV4,
        .nat_hook   = true,
        .hooknum    = NF_INET_POST_ROUTING,
        .priority   = NF_IP_PRI_NAT_SRC,
    },
    /* Before packet filtering, change destination */
    {
        .hook       = iptable_nat_ipv4_local_fn,
        .pf     = NFPROTO_IPV4,
        .nat_hook   = true,
        .hooknum    = NF_INET_LOCAL_OUT,
        .priority   = NF_IP_PRI_NAT_DST,
    },
    /* After packet filtering, change source */
    {
        .hook       = iptable_nat_ipv4_fn,
        .pf     = NFPROTO_IPV4,
        .nat_hook   = true,
        .hooknum    = NF_INET_LOCAL_IN,
        .priority   = NF_IP_PRI_NAT_SRC,
    },
};
```
nat表的初始化：
```c
static int __init iptable_nat_init(void)
    iptable_nat_table_init(&init_net)
        struct ipt_replace *repl;
        repl = ipt_alloc_initial_table(&nf_nat_ipv4_table);
        //调用ipt_register_table注册nat表
        ret = ipt_register_table(net, &nf_nat_ipv4_table, repl,
                 nf_nat_ipv4_ops, &net->ipv4.nat_table);

```

### NAT钩子回调函数

NAT的核心实现位于net/netfilter/nf_nat_core.c。NAT实现的基本元素为结构nf_nat_l4proto和nf_nat_l3proto。
(在3.7之前的内核中，使用的是结构nf_nat_protocol)。这两个结构都包含函数指针manip_pkt()，它会修改数据报头。
下面看下这两个结构。
```c
static const struct nf_nat_l3proto nf_nat_l3proto_ipv4 = {
    .l3proto        = NFPROTO_IPV4,
    .in_range       = nf_nat_ipv4_in_range,
    .secure_port        = nf_nat_ipv4_secure_port,
    .manip_pkt      = nf_nat_ipv4_manip_pkt, //修改ip包
    .csum_update        = nf_nat_ipv4_csum_update,
    .csum_recalc        = nf_nat_ipv4_csum_recalc,
#if IS_ENABLED(CONFIG_NF_CT_NETLINK)
    .nlattr_to_range    = nf_nat_ipv4_nlattr_to_range,
#endif
#ifdef CONFIG_XFRM
    .decode_session     = nf_nat_ipv4_decode_session,
#endif
};

//专门看下这个修改ip包的函数nf_nat_ipv4_manip_pkt
static bool nf_nat_ipv4_manip_pkt(struct sk_buff *skb,
                  unsigned int iphdroff,
                  const struct nf_nat_l4proto *l4proto,
                  const struct nf_conntrack_tuple *target,
                  enum nf_nat_manip_type maniptype)
    ...
    if (maniptype == NF_NAT_MANIP_SRC) {
        csum_replace4(&iph->check, iph->saddr, target->src.u3.ip);
        iph->saddr = target->src.u3.ip; //修改源IP
    } else {
        csum_replace4(&iph->check, iph->daddr, target->dst.u3.ip);
        iph->daddr = target->dst.u3.ip; //修改目标IP
    }

//TCP
const struct nf_nat_l4proto nf_nat_l4proto_tcp = {
    .l4proto        = IPPROTO_TCP,
    .manip_pkt      = tcp_manip_pkt, //修改IP包
    .in_range       = nf_nat_l4proto_in_range,
    .unique_tuple       = tcp_unique_tuple,
#if IS_ENABLED(CONFIG_NF_CT_NETLINK)
    .nlattr_to_range    = nf_nat_l4proto_nlattr_to_range,
#endif
};

//看下tcp_manip_pkt, udp的类似
static bool tcp_manip_pkt(struct sk_buff *skb,
          const struct nf_nat_l3proto *l3proto,
          unsigned int iphdroff, unsigned int hdroff,
          const struct nf_conntrack_tuple *tuple,
          enum nf_nat_manip_type maniptype)
    ...
    if (maniptype == NF_NAT_MANIP_SRC) {
        /* Get rid of src port */
        newport = tuple->src.u.tcp.port;
        portptr = &hdr->source;
    } else {
        /* Get rid of dst port */
        newport = tuple->dst.u.tcp.port;
        portptr = &hdr->dest;
    }
    oldport = *portptr;
    *portptr = newport; //修改端口号
```

继续看下NAT模块注册的netfilter钩子函数。IPv4 NAT模块在4个挂载点注册了钩子函数，
这4个函数最终都调用到nf_nat_ipv4_fn()。
```c
unsigned int nf_nat_ipv4_fn(void *priv, struct sk_buff *skb, const struct nf_hook_state *state,
           unsigned int (*do_chain)(void *priv,
                    struct sk_buff *skb,
                    const struct nf_hook_state *state,
                    struct nf_conn *ct))
    struct nf_conn *ct;
    enum ip_conntrack_info ctinfo;
    ct = nf_ct_get(skb, &ctinfo);
    if (!ct)
        return NF_ACCEPT; //没有连接跟踪就直接返回

    switch (ctinfo)
    case IP_CT_NEW:
        if (!nf_nat_initialized(ct, maniptype))
            //do_chain最终调用ipt_do_table，在nat标准查找指定条目，找到则调用target的回调函数
            do_chain(priv, skb, state, ct);

    //执行报文修改操作
    nf_nat_packet(ct, ctinfo, state->hook, skb);
        //这里的l3proto对应前面讲的nf_nat_l3proto_ipv4
        l3proto = __nf_nat_l3proto_find(target.src.l3num);
        //如果是TCP的话，l4proto是nf_nat_l4proto_tcp
        l4proto = __nf_nat_l4proto_find(target.src.l3num,target.dst.protonum)
        l3proto->manip_pkt(skb, 0, l4proto, &target, mtype) //调用manip_pkt函数
```


------
参考文章：
https://www.kancloud.cn/pshizhsysu/network/2158320
