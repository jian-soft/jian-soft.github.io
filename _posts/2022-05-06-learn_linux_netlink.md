---
title: Linux netlink详解
---

熟悉Linux wifi的同学都知道，wpa_supplicant程序是基于netlink与wifi驱动进行通信的。
(wpa_supplicant是wifi station用户空间守护进程)

本文学习下Linux的netlink，给出用户空间与内核空间基于netlink通信的示例。
示例包括netlink和generic netlink。用户空间程序包括基于原生Linux API和基于libnl API。

## netlink基础

netlink协议是一个基于socket的，用于内核与用户空间进程通信的一个协议。

用户态创建netlink socket的代码如下：
```c
int fd = socket(AF_NETLINK, SOCK_RAW, MY_NETLINK)

//socket接口的原型为：
int socket(int domain, int type, int protocol);
//这里用到了第三个入参protocol，即创建Netlink socket时要指定协议号
```
内核态创建netlink socket的接口原型为：
```c
struct sock *
netlink_kernel_create(struct net *net, int unit, struct netlink_kernel_cfg *cfg)
//这里的第二个参数unit为协议号，与用户空间的protocol相同
```

Netlink消息有固定的格式，struct nlmsghdr
```c
struct nlmsghdr {
    __u32       nlmsg_len;  /* Length of message including header */
    __u16       nlmsg_type; /* Message content */
    __u16       nlmsg_flags;    /* Additional flags */
    __u32       nlmsg_seq;  /* Sequence number */
    __u32       nlmsg_pid;  /* Sending process port ID */
};
```

完整示例见github: <https://github.com/jian-soft/netlink_examples>

下文为关键代码注释。

## 原生Linux API示例

### 内核侧示例

```c
//定义自己的netlink协议号
#define MY_NETLINK 31

//接收回调，即内核侧收到用户发来的netlink消息回调
static void netlink_recv_msg(struct sk_buff *skb)
{
    ...
    nlh = (struct nlmsghdr *)skb->data;  //取netlink消息头
    pid = nlh->nlmsg_pid; /* pid of sending process */
    msg = (char *)nlmsg_data(nlh);  //取netlink消息data部分
    msg_size = strlen(msg);
    
    printk(KERN_INFO "netlink_kernel: Received from pid %d: %s\n", pid, msg);
    ...
}

//定义netlink_kernel_cfg，即声明接收回调
struct netlink_kernel_cfg cfg = {
    .input = netlink_recv_msg,
};

//创建内核测netlink socket
g_nl_sock = netlink_kernel_create(&init_net, MY_NETLINK, &cfg);
if (!g_nl_sock) {
    printk(KERN_ALERT "netlink_kernel: Error creating socket.\n");
    return -10;
}
```

### 用户侧示例

```c
int main(int argc, char* argv[])
{
    //创建socket
    sock_fd = socket(PF_NETLINK, SOCK_RAW, MY_NETLINK);

    memset(&src_addr, 0, sizeof(src_addr));
    src_addr.nl_family = AF_NETLINK;
    src_addr.nl_pid = getpid(); /* self pid */
    //绑定端口
    bind(sock_fd, (struct sockaddr*)&src_addr, sizeof(src_addr));
    
    //设置目标地址为内核netlink
    memset(&dest_addr, 0, sizeof(dest_addr));
    dest_addr.nl_family = AF_NETLINK;
    dest_addr.nl_pid = 0; /* For Linux Kernel */
    dest_addr.nl_groups = 0; /* unicast */
    
    //可以通过sendmsg或sendto两种接口向内核发送消息
    //相应的有recvmsg和recvfrom两种接口接收来自内核的消息
    //详见github，此处略
}
```

## libnl API示例

**libnl**对用户空间Linu原生的netlink API进行了封装，使得用户空间程序更容易编写，尤其是对于generic netlink API。
关于generic netlink API我们下一章节详细介绍。

另外wpa_supplicant与内核wifi驱动的通信就是用的libnl generic netlink API。

先介绍下libnl的主要接口，定义在头文件<netlink/netlink.h>
```c
//创建netlink socket, libnl中用struct nl_sock表示一个socket
#include <netlink/socket.h>
struct nl_sock *nl_socket_alloc(void)
void nl_socket_free(struct nl_sock *sk)

//回调配置
struct nl_cb *nl_socket_get_cb(const struct nl_sock *sk);
void nl_socket_set_cb(struct nl_sock *sk, struct nl_cb *cb);
int nl_socket_modify_cb(struct nl_sock *, enum nl_cb_type, enum nl_cb_kind, nl_recvmsg_msg_cb_t, void *);

//发送
int nl_send_auto(struct nl_sock *sk, struct nl_msg *msg)
int nl_send(struct nl_sock *sk, struct nl_msg *msg)
int nl_send_iovec(struct nl_sock *sk, struct nl_msg *msg, struct iovec *iov, unsigned iovlen)
int nl_sendmsg(struct nl_sock *sk, struct nl_msg *msg, struct msghdr *hdr) //nl_sendmsg里调用Linux原生sendmsg接口
int nl_sendto(struct nl_sock *sk, void *buf, size_t size) //nl_sendto调用Linux原生sendto接口
int nl_send_simple(struct nl_sock *sk, int type, int flags, void *buf, size_t size)

//接收
int nl_recvmsgs_default(struct nl_sock *sk)

int nl_recvmsgs(struct nl_sock *sk, struct nl_cb *cb)
//如果socket是阻塞的，就阻塞式接收。recv到数据之后，通过cb进行处理
```

### libnl用户侧示例

基于上一节的例子，内核测代码不变，用户侧使用libnl重写。

```c
#include <netlink/netlink.h>
#include <netlink/msg.h>

#define MY_NETLINK 31
#define MY_NETLINK_TYPE_SET 0

//接收回调
static int my_input(struct nl_msg *msg, void *arg)
{
    struct nlmsghdr *nlh = nlmsg_hdr(msg);
    char *data = nlmsg_data(nlh);
    int datalen = nlmsg_datalen(nlh);

    printf("input cb: datalen:%d, data:%d\n", datalen, data);

    return 0;
}

int main(int argc, char* argv[])
{
    struct nl_sock *sk;
    int ret;
    //创建并绑定socket
    sk = nl_socket_alloc();
    ret = nl_connect(sk, MY_NETLINK);

    //修改接收回调函数，收到任何消息都会回调my_input
    nl_socket_modify_cb(sk, NL_CB_MSG_IN, NL_CB_CUSTOM, my_input, NULL);

    char msg[] = "Hello libnl!\n"
    ret = nl_send_simple(sk, MY_NETLINK_TYPE_SET, 0, msg, sizeof(msg));

    //阻塞式等待接收。接收到内核发来的消息后，会进入接收回调my_input
    nl_recvmsgs_default(sk);

    nl_socket_free(sk);
}

```

## generic netlink示例，基于libnl

netlink通信协议在不修改内核源码的情况下，最大只支持定义32种协议。
随着netlink的使用越来越多，32个协议号已不够用，所以引入了generic netlink。
generic netlink其实是对netlink报文进行了又一次封装，generic netlink使用的netlink协议号是NETLINK_GENERIC=16。

genl的消息格式如下：
```c
  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 |                Netlink message header (nlmsghdr)              |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 |           Generic Netlink message header (genlmsghdr)         |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 |             Optional user specific message header             |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 |           Optional Generic Netlink message payload            |
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 
 struct genlmsghdr {
    __u8    cmd;
    __u8    version;
    __u16   reserved;
};

//genl的message payload基于netlink的属性机制，即payload是由一个个nlattr组成
/*
 *  <------- NLA_HDRLEN ------> <-- NLA_ALIGN(payload)-->
 * +---------------------+- - -+- - - - - - - - - -+- - -+
 * |        Header       | Pad |     Payload       | Pad |
 * |   (struct nlattr)   | ing |                   | ing |
 * +---------------------+- - -+- - - - - - - - - -+- - -+
 *  <-------------- nlattr->nla_len -------------->
 */
struct nlattr {
    __u16           nla_len;
    __u16           nla_type;
};
```

### genl内核侧示例

参考：
https://wiki.linuxfoundation.org/networking/generic_netlink_howto

注意：genl_register_ops接口只在3.12及之前版本有；
3.13~4.9版本用genl_register_family_with_ops；
4.10版本及以后没有注册ops的接口，只有注册family的接口，ops要直接定义在family内。

本文示例基于4.15内核。

注册generic netlink family需要3步:
1. 定义操作
2. 定义family
3. 注册family

```c
/* Step1: 定义操作 */
/* attributes */
enum {
    EXMPL_A_UNSPEC,
    EXMPL_A_MSG,
    _EXMPL_A_MAX,
};
#define EXMPL_A_MAX (_EXMPL_A_MAX - 1)
/* attribute policy */
static struct nla_policy exmpl_genl_policy[EXMPL_A_MAX + 1] = {
    [EXMPL_A_MSG] = {.type = NLA_NUL_STRING},
};
// handler
static int exmpl_echo(struct sk_buff *skb, struct genl_info *info);
// commands
enum {
    EXMPL_C_UNSPEC,
    EXMPL_C_ECHO,
    _EXMPL_C_MAX,
};
#define EXMPL_C_MAX (_EXMPL_C_MAX - 1)
// operation definition
struct genl_ops exmpl_genl_ops[EXMPL_C_MAX] = {
    {
        .cmd = EXMPL_C_ECHO,
        .doit = exmpl_echo,
        .policy = exmpl_genl_policy,
    }
};
```

```c
#define FAMILY_NAME "my_genl"
/* Step2: 定义family */
// family definition
static struct genl_family my_genl_family = {
    .id = 0,
    .hdrsize = 0,  //表示没有用户自定义的额外header
    .name = FAMILY_NAME,
    .version = 1,
    .ops = exmpl_genl_ops,
    .n_ops = ARRAY_SIZE(exmpl_genl_ops),
    .maxattr = EXMPL_A_MAX + 1,
};

// handler的具体定义
static int exmpl_echo(struct sk_buff *skb, struct genl_info *info)
{
    struct nlattr *na;
    struct sk_buff *reply_skb;
    void *msg_head;
    int ret;

    printk("%s in.\n", __func__);

    //内核已经解析好了每个attr
    na = info->attrs[EXMPL_A_MSG];
    if (!na) {
        printk("Error: attr EXMPL_A_MSG is null\n");
        return -EINVAL;
    }
    printk("Recv message: %s\n", nla_data(na));

    //将收到的消息发回去
    reply_skb = genlmsg_new(NLMSG_GOODSIZE, GFP_KERNEL);
    //填写genl消息头
    msg_head = genlmsg_put(reply_skb, info->snd_portid, info->snd_seq, &my_genl_family, 0, EXMPL_C_ECHO);
    //向skb尾部填写attr
    nla_put_string(reply_skb, EXMPL_A_MSG, nla_data(na));
    //Finalize the message: 更新nlmsghdr中的nlmsg_len字段
    genlmsg_end(reply_skb, msg_head);
    //Send the message back
    ret = genlmsg_reply(reply_skb, info);
    if (ret != 0) {
        printk("genlmsg_reply return fail: %d\n", ret);
        return -ret;
    }

    return 0;
}
```

```c
/* Step3: 注册famliy */
int ret;
ret = genl_register_family(&my_genl_family);
if (err != 0) {
    printk("genl_register_family fail, ret:%d\n", ret);
    return ret;
}

```

### genl用户侧示例(基于libnl)

```c
#define MY_FAMILY_NAME "my_genl"

//用户侧需要定义和内核侧相同的属性以及命令，所以通常把这一部分摘成一个独立的.h，内核和app共用
//这里没有摘成一个独立的.h，用户侧也重复定义一份
/* attributes */
enum {
    EXMPL_A_UNSPEC,
    EXMPL_A_MSG,
    _EXMPL_A_MAX,
};
#define EXMPL_A_MAX (_EXMPL_A_MAX - 1)
// define attribute policy
static struct nla_policy exmpl_genl_policy[EXMPL_A_MAX + 1] = {
    [EXMPL_A_MSG] = {.type = NLA_STRING},
};
// commands
enum {
    EXMPL_C_UNSPEC,
    EXMPL_C_ECHO,
    _EXMPL_C_MAX,
};
#define EXMPL_C_MAX (_EXMPL_C_MAX - 1)

//接收回调定义
int recv_callback(struct nl_msg* recv_msg, void* arg)
{
    struct nlmsghdr *nlh = nlmsg_hdr(recv_msg);
    struct nlattr *tb_msg[EXMPL_A_MAX + 1];

    if (nlh->nlmsg_type == NLMSG_ERROR) {
        printf("Received NLMSG_ERROR message!\n");
        return NL_STOP;
    }

    struct genlmsghdr *gnlh = (struct genlmsghdr*)nlmsg_data(nlh);
    //按照每attr解析内核发来的genl消息
    nla_parse(tb_msg, EXMPL_A_MAX,
              genlmsg_attrdata(gnlh, 0),
              genlmsg_attrlen(gnlh, 0),
              exmpl_genl_policy);

    //判断是否包含属性EXMPL_A_MSG
    if (tb_msg[EXMPL_A_MSG]) {
        // parse it as string
        char * payload_msg = nla_get_string(tb_msg[EXMPL_A_MSG]);
        printf("Kernel replied: %s\n", payload_msg);
    } else {
        printf("Attribute EXMPL_A_MSG is missing\n");
    }

    return NL_OK;
}

int main(int argc, char* argv[])
{
    //创建并连接genl socket
    struct nl_sock *sk = nl_socket_alloc();
    genl_connect(sk);
    //根据FAMILY_NAME获得对应的famlily_id
    int family_id;
    family_id = genl_ctrl_resolve(sk, FAMILY_NAME);
    if (family_id < 0) {
        printf("generic netlink family '" FAMILY_NAME "' NOT REGISTERED\n");
        nl_socket_free(sk);
        exit(-1);
    } else {
        printf("Family-ID of generic netlink family '" FAMILY_NAME "' is: %d\n", family_id);
    }

    //设置接收回调 
    nl_socket_modify_cb(sk, NL_CB_MSG_IN, NL_CB_CUSTOM, recv_callback, NULL);

    //发送消息
    struct nl_msg *msg = nlmsg_alloc();
    genlmsg_put(msg, NL_AUTO_PORT, NL_AUTO_SEQ, family_id,
                0, NLM_F_REQUEST, EXMPL_C_ECHO, 1);
    NLA_PUT_STRING(msg, EXMPL_A_MSG, "genl message from user to kernel");
    int res = nl_send_auto(sk, msg);
    nlmsg_free(msg);
    if (res < 0) {
        printf("nl_send_auto fail, ret:%d\n", res);
    } else {
        printf("nl_send_auto OK, ret: %d\n", res);
    }

    //接收消息。接收到内核发来的消息后，触发回调recv_callback
    nl_recvmsgs_default(sk);

nla_put_failure: //referenced by NLA_PUT_STRING 
    nl_socket_free(sk);

    return 0;
}
```

这里的示例是内核收到用户空间发来的genl消息后，根据发送端的struct genl_info *info，
调用genlmsg_reply(reply_skb, info)，将内核的genl消息单播给用户空间app。

如果内核不知道用户空间的socket信息，内核如何将消息发送到用户空间呢？
这时一般用组播netlink消息，即内核将消息组播出去。用户空间谁订阅了这个组播，谁就能收到内核发来的消息。
关于组播netlink示例，后续有空再补一下。。。

----

完整示例见github: <https://github.com/jian-soft/netlink_examples>
