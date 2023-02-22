---
title: 使用memwatch检测内存越界
---

## 引言

最近在嵌入式Linux环境下，遇到了一个第三方程序概率性段错误退出的问题。

通过分析程序异常退出后产生的coredump文件，发现程序是挂在malloc调用里：
```
#0  unbin (c=0x77a85fa8, i=1) at src/malloc/malloc.c:228
#1  0x77adf254 in malloc (n=32) at src/malloc/malloc.c:356
#2  0x77a45037 in switch_create_table_entry (port_index=4 '\004', age=0 '\000', mac=0x0, vid=<optimized out>) at mediatek/switch_layer.c:615
#3  0x77a45341 in switch_layer_get_table_entry (entry_list=<optimized out>) at mediatek/switch_layer.c:1077
#4  0x00454745 in dl_list_del (item=0x48c6dc <cmd_buf+56>) at ethernet/list.h:44
...
```

网上搜索了下类似的调用栈，基本结论是这个错误发生前有内存越界写入，导致malloc维护的内存块信息出错，进而导致此次的malloc出现段错误。

所以问题明确了：**如何找到代码中的内存越界写入？**

当然，我是有这个第三方程序源码的。于是想阅读源码，排查每一处malloc之后的内存读写代码，但鉴于代码规模庞大，人工排查无异于大海捞针，不具可行性。

继续网上搜索，发现了memwatch工具，最终问题得以解决。本文记录下使用memwatch的过程。

## memwatch介绍

memwatch可以用来检测内存泄漏和内存越界写入。

从网上找到的最新版本是2.71. https://sourceforge.net/projects/memwatch/files/memwatch/

memwatch源码只有两个文件：memwatch.h和memwatch.c。使用起来也很简单，参见源码里的README，只需要三步：

1. 所有的源文件都要包含memwatch.h文件
2. 打开MEMWATCH预编译宏，重新编译程序；在gcc中，就是增加编译选项-DMEMWATCH
3. 运行程序，检查生成的memwatch.log文件


## 调试记录

### test.c

先试一下memwatch源码自带的test.c。解压下载下来的源码文件mw271.zip，里面有一个test.c。

```
//注释掉test.c的最后一行，然后编译
gcc -o test -DMEMWATCH -DMEMWATCH_STDIO test.c memwatch.c
//运行程序
./test
//检查生成的memwatch.log文件
```

简单介绍下memwatch.log中的内容：
```
underflow: <5> test.c(62), 200 bytes alloc'd at <4> test.c(60)
//underflow表示内存向下越界写入。即test.c的第62行，检测到test.c第60行申请的200Byte内存有向下越界写入

unfreed: <3> test.c(59), 20 bytes at 0x1291310
//unfreed表示未释放的内存。即test.c第59行申请的20Byte内存未释放

//再举一个overflow的例子，即向上越界写入，同underflow
overflow: <35670> src/cmdu_message_parse.c(3258), 2 bytes alloc'd at <35467> src/multi_ap.c(4955)
```

### 实际问题调试

我在文章开头提到的第三方程序加入memwatch.c和memwatch.h，实际调试时遇到了下面的问题：

1. 程序运行环境是mips平台，编译有遇到错误
2. 第三方程序是多线程的，多线程需要额外打开预编译宏MW_PTHREADS。但打开后会遇到死锁问题
3. 段错误后，程序是直接退出的，并不会刷新memwatch.log

根据实际遇到的问题，我修改了memwatch.c的源码，修改后的代码见github(github上可以查看修改记录)。

github: <https://github.com/jian-soft/memwatch>

最终我的修改如下：

1. 使用修改后的memwatch.c，将其编译到程序中
2. 增加预编译宏-DMEMWATCH -DMW_PTHREADS
3. 所有的.c文件开头增加:
```c
#ifdef MEMWATCH
#include "memwatch.h"
#endif
```
4. 在main()里增加对SIGSEGV的捕获，发生SIGSEGV后主动退出程序，触发memwatch.log刷新:

```c
void sigsegv_handler_fun(int signum) {
    char cmd[64] = {0};
    sprintf(cmd, "echo catch sigsegv > /tmp/dddd");
    system(cmd);
    exit(0);
}

int main(int argc, char *argv[])
{
    ...
    signal(SIGSEGV, sigsegv_handler_fun);
    ...
}
```

之后编译运行程序，坐等问题复现。果然，复现后，memwatch.log里出现了overflow的信息。

根据overflow信息，排查对应代码行，找到了内存越界写入的bug。


------

参考文章：

<https://www.linuxjournal.com/article/6059>