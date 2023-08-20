---
title: 两种进入和退出容器的方法以及它们之间的区别
date: 2023-08-08 14:12:17
categories: 学习过程
tags:
  - Docker
---

### 进入容器的两种方法

两种进入容器的方法分别是使用`exec`he`attach`两种方法。

具体如下：

* 使用`exec`的方式

```bash
docker exec -it nginx-1 /bin/bash
```

* 使用`attach`的方式

<!-- more -->

```bash
docker attach nginx-1
```

### 进入容器两种方法的区别

从下面的例子来看这两种进入容器的区别：

```bash
root@knight:/docker# docker ps 
CONTAINER ID   IMAGE         COMMAND       CREATED          STATUS          PORTS     NAMES
c2dbddec15d3   mynginx:0.1   "/bin/bash"   21 seconds ago   Up 20 seconds             nginx-1
root@knight:/docker# docker exec -it nginx-1 /bin/bash
root@c2dbddec15d3:/# exit
exit
root@knight:/docker# docker ps
CONTAINER ID   IMAGE         COMMAND       CREATED         STATUS         PORTS     NAMES
c2dbddec15d3   mynginx:0.1   "/bin/bash"   2 minutes ago   Up 2 minutes             nginx-1
root@knight:/docker# docker attach nginx-1
root@c2dbddec15d3:/# exit
exit
root@knight:/docker# docker ps
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
root@knight:/docker# 
```

可以观察到以下几点区别：

1. 进入容器的命令指定的参数不一样，exec更复杂一点，需要指定一些参数。

2. 使用exec进去的容器，exit退出之后，容器仍然运行，但是使用attach进入的容器，exit退出之后，容器直接停止了。

原因如下：

1. exec在进入容器时，会在容器里额外打开一个bash，当退出时，会停用当前的这个bash，也就是说，容器中还会有之前的bash在运行，有bash就有进程，有进程就不会停止容器。这也就是为什么exec在进入容器时，要指定一个解释器的原因。

2. 使用attach进入容器时，会直接进入容器当前存在的bash(解释器)，而不会打开新的解释器，而在退出的时候，则会关闭唯一存在的解释器，也就是说容器没有存在的进程了，容器就认为自己没有存在的价值了，就会自己停止。

### 退出容器的两种方法

玩容器比较少的可能只知道退出容器的方法只有`exit`命令，但是在容器退出的时候其实还有<kbd>Ctrl</kbd>+<kbd>p</kbd>+<kbd>q<kbd>方式退出。

### 退出容器的两种方法的区别

退出容器的区别有一个前提是构建这个容器的时候，没有指定-d选项。否则设置后台运行是没有任何区别的。

从下面的例子来看这两种退出容器的区别：

```bash
root@knight:/docker# docker images
REPOSITORY    TAG       IMAGE ID       CREATED             SIZE
mynginx       0.1       babef9096509   About an hour ago   140MB
nginx         latest    605c77e624dd   19 months ago       141MB
hello-world   latest    feb5d9fea6a5   22 months ago       13.3kB
root@knight:/docker# docker run -it --name nginx-2 nginx:latest /bin/bash
root@634746a9bd08:/# exit
exit
root@knight:/docker# docker ps
CONTAINER ID   IMAGE         COMMAND       CREATED          STATUS         PORTS     NAMES
root@knight:/docker# docker run -it --name nginx-3 nginx:latest /bin/bash
root@29ce1f7749cb:/# root@knight:/docker# docker ps
CONTAINER ID   IMAGE          COMMAND                  CREATED          STATUS         PORTS     NAMES
29ce1f7749cb   nginx:latest   "/docker-entrypoint.…"   9 seconds ago    Up 8 seconds   80/tcp    nginx-3
root@knight:/docker# 
```

可以观察到：

1. 在nginx-2这个容器中，使用exit退出之后，查看运行的容器，是查不到的，也就是说，退出意味着停止。

2. 在nginx-3这个容器中，使用<kbd>Ctrl</kbd>+<kbd>p</kbd>+<kbd>q<kbd>停止，停止后查看运行的容器，发现nginx-3容器仍在运行，得出结论使用快捷键退出不会导致容器停止。