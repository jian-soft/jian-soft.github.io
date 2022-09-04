---
title: 算法学习之AVL树(平衡二叉排序树)
---

## 引言

最近打算补充下算法方面的知识，开一个《算法学习》专栏。

熟悉OpenWRT Linux系统的朋友都知道，OpenWRT里有一个基础库叫libubox，libubox是一些常用的C库的集合。
最常用的就是双向链表库"list.h"，和内核的链表头文件<linux/list.h>类似。此外还有md5、base64等常用工具库。
libubox中也有AVL库，本文基于libubox的AVL库代码，学习下AVL树的结构和相关操作。
当然不熟悉OpenWRT或libubox库完全不影响阅读本文。

## 什么是AVL树

什么是AVL树呢？AVL树是**平衡二叉排序树**，是以它的发现者Adelson-Velsky和Landis的名字命名的。

首先什么是**二叉树**：二叉树的每个节点至多只有两棵子树，并且子树有左右之分。

再看**平衡二叉树**：平衡二叉树的左子树和右子树都是平衡二叉树，且左右子树的深度之差的绝对值不超过1。（树的深度即从根节点到叶子节点的距离或步数）

再看**二叉排序树**：它的左子树如果不为空，则左子树上的所有节点的值均小于它的根节点的值；它的右子树如果不为空，
则右子树上所有节点的值均大于它根节点的值；它的左右子树也分别是二叉排序数。

二叉排序树又可以称为二叉查找树，所以平衡二叉排序树的英文全称可以是Balanced Binary Search Tree，简称BBST。

平衡二叉排序树通常用在动态数据表查找上。动态数据表的意思是要查找的数据表是动态生成的，不是一个静态的数据表。
这是因为对一个平衡二叉排序树的查找操作，类似于静态排序表的折半查找，效率是很高的，其时间复杂度为O(log n)。
这一点大家手画一个二叉排序树比划一下，就能感受出来。（严格数学证明不在本文范畴内^_^）

AVL树最大的特性是**自平衡性**。这里自平衡的意思是，当AVL树因为插入一个节点而失去平衡时，
只需对节点进行有限且有规律的被称为“左旋”或“右旋”的操作，就可以使树再次平衡。

## AVL库代码学习

代码基于libubox的AVL库：libubox/avl.h, libubox/avl.c

### AVL树对象定义

先看下AVL树对象的定义：
```c
//AVL节点对象
struct avl_node {
    struct list_head list; //libubox的AVL库将所有节点串成一个双向链表
    struct avl_node *parent; //指向父节点
    struct avl_node *left; //左子节点
    struct avl_node *right; //右子节点
    const void *key; //节点存储的值
    signed char balance; //平衡因子: 取值0 -1 +1
                         //-1表示左子树深度大1，+1表示右子树深度大1，0表示一样大
    bool leader;
};

//AVL树对象
typedef int (*avl_tree_comp) (const void *k1, const void *k2, void *ptr);
struct avl_tree {
    struct list_head list_head; //libubox的AVL库将所有节点串成一个有序双向链表，方便遍历
    struct avl_node *root; //树的根节点
    unsigned int count; //树中节点的个数
    bool allow_dups; //树中是否允许key相同的节点存在，libubox的AVL库支持插入相同的节点
    avl_tree_comp comp; //节点大小比较函数
    void *cmp_ptr; //比较函数的第三个入参
};
```

接下来看AVL树的3个主要方法：查找、插入、删除。

### 查找节点 avl_find()

查找节点：avl_find()
```c
//在一棵AVL树中，查找值为key的节点，找到则返回找到的节点，找不到则返回空
struct avl_node *avl_find(const struct avl_tree *tree, const void *key)
    struct avl_node *node;
    int diff;
    if (tree->root == NULL)
        return NULL; //树为空则直接返回空
    //递归查找节点。入参是节点、key值、比较函数，出参是比较值
    node = avl_find_rec(tree->root, key, tree->comp, tree->cmp_ptr, &diff)
        int diff = (*comp) (key, node->key, cmp_ptr); //计算传入的key和节点的key的差值
        if (diff < 0) //如果差值小于0，即匹配的key值应该在节点的左子树，继续去左子树寻找
            if (node->left != NULL)
                return avl_find_rec(node->right, key, comp, cmp_ptr, cmp_result);
            else
                return node //如果没有左子树了，则返回这个叶节点
        if (diff > 0) //如果差值大于0，即匹配的key值应该在节点的右子树，继续去右子树寻找
            if (node->right != NULL)
                return avl_find_rec(node->right, key, comp, cmp_ptr, cmp_result)
            else
                return node //如果没有右子树了，则返回这个叶节点
        return node //如果差值等于0，则返回这个匹配的节点

    return diff == 0 ? node : NULL //如果差值不等于0，表示没找到匹配的节点，返回空
```

### 插入节点 avl_insert()

插入节点：avl_insert()。本节包含AVL树的左旋或右旋操作，是AVL树的关键特性所在。
```c
int avl_insert(struct avl_tree *tree, struct avl_node *new)
    //对要插入new节点除了key属性以外的其它属性赋初值
    new->parent = NULL;
    new->left = NULL;
    new->right = NULL;
    new->balance = 0;
    new->leader = true;

    if (tree->root == NULL)
        //如果这个树没有节点存在
        list_add(&new->list, &tree->list_head) //new节点直接插入树中
        tree->root = new //树的根节点指向这个new节点
        tree->count = 1 //此时树的节点个数变为1
        return 0

    //递归查找与new节点相同或相近的节点node
    node = avl_find_rec(tree->root, new->key, tree->comp, tree->cmp_ptr, &diff);
    last = node;

    //遍历last的next节点，即如果有key值相同的节点，取所有相同key值节点的最后一个
    while (!list_is_last(&last->list, &tree->list_head)) {
        next = avl_next(last);
        if (next->leader)
          break;
        last = next;

    diff = (*tree->comp) (new->key, node->key, tree->cmp_ptr); //再次计算差值，这一步是多余的？
    if (diff == 0)
        if (!tree->allow_dups)
          return -1; //不允许插入相同key值节点时，直接返回-1
        new->leader = 0; //leader置0表示已存在相同key值的节点
        avl_insert_after(tree, last, new); //将此节点插入双向链表
        return 0;

    if (node->balance == 1)
        //节点的平衡度为1，表示右子树深度大。此时直接将new节点插入node节点左侧即可
        avl_insert_before(tree, node, new);
        node->balance = 0; //插入new节点后node节点左右深度相同
        new->parent = node;
        node->left = new; //将new节点插入到node节点左侧
        return 0;

    if (node->balance == -1)
        //节点的平衡度为-1，表示左子树深度大。此时直接将new节点插入node节点右侧即可
        avl_insert_after(tree, last, new);
        node->balance = 0; //插入new节点后node节点左右深度相同
        new->parent = node;
        node->right = new; //将new节点插入到node节点的右侧
        return 0;

    if (diff < 0) { //new节点小于node节点，插入node节点左侧
        avl_insert_before(tree, node, new);
        node->balance = -1; //左子树深度变大
        new->parent = node;
        node->left = new; //将new节点插入到node节点左侧
        post_insert(tree, node); //插入后处理，后面专门看这个函数
        return 0;

    //new节点大于node节点，插入node节点右侧
    avl_insert_after(tree, last, new);
    node->balance = 1;
    new->parent = node;
    node->right = new;
    post_insert(tree, node); //插入后处理

/*
 总结下插入逻辑：
 在没有相同节点的情况下，插入分两大类。
 大类一：node节点平衡因子不为0，插入new后node节点的平衡因子变为0，不需要后处理
 大类二：node节点平衡因子为0，插入new后node节点平衡因子不为0，需要后处理
 */

//接下来看下后处理函数，这里是AVL树最具特点的地方，
//即插入一个新节点后，如果二叉树不再平衡，只需要特定的左旋右旋操作，二叉树就可再次平衡
static void post_insert(struct avl_tree *tree, struct avl_node *node)
    struct avl_node *parent = node->parent; //得到node节点的父节点
    if (parent == NULL)
        return //如果父节点为空，说明node节点就是整个AVL树的根节点，此时什么都不用做

    if (node == parent->left)
        //如果node节点在左侧，即插入的new节点在父节点的左子树
        parent->balance--; //父节点左侧深度增加
        if (parent->balance == 0)
            return; //如果父节点左右深度相同，则什么都不用做
        if (parent->balance == -1)
            //如果左子树深度大1，递归调用post_insert，也就是修改所有父节点的balance为-1
            post_insert(tree, parent);
            return;

        //函数走到此，说明parent->balance=-2，父节点不再平衡，需要旋转操作
        if (node->balance == -1)
            //如果node节点左子树深度大1，则进行右旋操作，后面单独看旋转操作函数
            avl_rotate_right(tree, parent);
            return;
        //如果node节点右子树大1，则先左旋，再右旋
        avl_rotate_left(tree, node);
        avl_rotate_right(tree, node->parent->parent);
        return;

    //以下是node节点在parent节点右侧的情况，与上面的代码对称
    parent->balance++; //父节点的右侧深度增加
    if (parent->balance == 0)
        return; //如果父节点左右深度相同，则什么都不用做
    if (parent->balance == 1)
        //如果左子树深度大1，递归调用post_insert，也就是修改所有父节点的balance为1
        post_insert(tree, parent);
        return;

    //函数走到此，说明parent->balance=2，父节点不再平衡，需要旋转操作
    if (node->balance == 1)
        //如果node节点右子树深度大1，则进行左旋操作
        avl_rotate_left(tree, parent);
        return;
    //如果node节点左子树大1，则先右旋，再左旋
    avl_rotate_right(tree, node);
    avl_rotate_left(tree, node->parent->parent);

//接下来看一下旋转操作的代码
//左旋
static void avl_rotate_left(struct avl_tree *tree, struct avl_node *node)
    struct avl_node *right, *parent;
    right = node->right; //记录node节点的右节点和父节点
    parent = node->parent;

    right->parent = parent; //右节点和node节点互换位置
    node->parent = right;
    if (parent == NULL) //如果父节点是空，则修改树的根节点
        tree->root = right;
    else
        //将父节点的子节点node修改为right
        if (parent->left == node)
            parent->left = right;
        else
            parent->right = right;
    node->right = right->left; //right的左节点赋给node右节点
    right->left = node; //node置为right节点的左节点
    if (node->right != NULL)
        node->right->parent = node; //如果node的右节点不为空，改一下其父节点
    node->balance -= 1 + avl_max(right->balance, 0); //修正平衡因子，至少减1，即右子树深度至少减1
    right->balance -= 1 - avl_min(node->balance, 0);

//右旋。与左旋相反
static void avl_rotate_right(struct avl_tree *tree, struct avl_node *node)
    struct avl_node *left, *parent;
    left = node->left;
    parent = node->parent;

    left->parent = parent; //左节点和node节点互换
    node->parent = left;
    if (parent == NULL)
        tree->root = left;
    else
        if (parent->left == node)
            parent->left = left;
        else
            parent->right = left;
    node->left = left->right;
    left->right = node;
    if (node->left != NULL)
        node->left->parent = node;
    node->balance += 1 - avl_min(left->balance, 0);
    left->balance += 1 + avl_max(node->balance, 0);
```

### 删除节点 avl_delete()

删除节点avl_delete()
```c
//删除节点逻辑也比较长，这里只介绍下梗概
void avl_delete(struct avl_tree *tree, struct avl_node *node)
    //如果node是一个重复节点，则直接删除，不涉及二叉树结构的变动

    //真正从二叉树删除一个节点
    avl_delete_worker(tree, node)
        //node是叶子节点时：
        if (node->left == NULL && node->right == NULL)
            //根据node父节点的平衡因子，进行后处理和旋转操作
        //node的左节点为空时：
        if (node->left == NULL)
            //将node的右节点代替node节点，并调用avl_post_delete
        //node的右节点为空时：
        if (node->right == NULL)
            //将node的左节点代替node节点，并调用avl_post_delete
        //node的左右节点都不为空时
        min = avl_local_min(node->right); //取node右子树的最小值节点min，此节点要么是叶子节点要么左节点为空
        avl_delete_worker(tree, min); //嵌套调用avl_delete_worker，删除这个min节点
        //用min节点代替node节点，从而删除了node节点
```

### 遍历节点

libubox的AVL库已经把所有的节点串成了一个有序的双向链表，所以对AVL树的遍历就变成了对双向链表的遍历。
AVL库对外提供了很多遍历宏，而这些宏的最终调用的是
avl_for_element_range avl_for_element_range_safe avl_for_element_range_reverse avl_for_element_range_reverse_safe

我们来看一下avl_for_element_range
```c
//这里入参first和last是指向包含avl_node结构的大结构体的指针，即遍历的起始大结构体和结束大结构体
//element是指向每一个遍历到的大结构体，node_member是avl_node结构体在大结构体中的成员名
#define avl_for_element_range(first, last, element, node_member) \
  for (element = (first); \
       element->node_member.list.prev != &(last)->node_member.list; \
       element = avl_next_element(element, node_member))

//avl_next_element，即取avl_node.list->next，然后利用container_of取到大结构体
#define avl_next_element(element, node_member) \
  container_of((&(element)->node_member.list)->next, typeof(*(element)), node_member.list)
```

再看下全节点遍历avl_for_each_element
```c
//全节点遍历即调用avl_for_element_range，然后入参是AVL树的第一个节点和最后一个节点
//即从树的第一个节点 遍历到树的最后一个节点
#define avl_for_each_element(tree, element, node_member) \
  avl_for_element_range(avl_first_element(tree, element, node_member), \
                        avl_last_element(tree, element,  node_member), \
                        element, node_member)
```

## AVL库实际使用举例

如文章开头提到的AVL树非常适合用在动态数据表查找上，查找的时间复杂度是O(log n)。
我们以有1000个数据的数据表举例，如果这个数据表用线性链表存储，查找一个数据最大可能搜索1000次；
如果用AVL树存储，最大只需要搜索10次。

OpenWRT中有一个重要的进程间通信组件ubus，就是用的AVL树维护ubus总线上各对象的信息。

这样在ubus总线上，即使有很多进程注册了很多ubus对象，ubusd内部可以根据目标对象ID或名称字符串，
在AVL树上很快搜索到目标对象。
```c
//ubus/ubusd_proto.c
static int ubusd_handle_lookup()
	char *objpath;
	objpath = blob_data(attr[UBUS_ATTR_OBJPATH]);
	...
	obj = avl_find_element(&path, objpath, obj, path) //AVL树查找
	...

```
