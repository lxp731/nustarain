---
title: OSI模型与TCP/IP模型
# password: hello
date: 2024-04-10 10:45:28
categories: 理论知识
tags:
  - 面试
  - 网络基础
---

### OSI七层模型

OSI七层模型分别是：应用层、表示层、会话层、 运输层、网络层、数据链路层、物理层。

> 有的将运输层讲为传输层，其实大家表达的意思都一样。

<!-- more -->

#### 应用层

应用层是直接面向用户的，提供UI页面的。

#### 表示层

表示层负责数据的加密与解密，数据的格式转换、数据的压缩与解压。

#### 会话层

会话层负责管理会话。建立连接，维护连接，控制连接的建立与终止。包括何时开始会话，何时交换数据，数据发送方式（轮流发送、同时发送）、会话中断如何恢复、会话如何结束。

#### 运输层

段是运输层的数据传输单位，运输层是在为正在通讯的两台主机的应用进程服务的，并且提供的是可靠的数据传输服务。特别留意运输层是**端到端的通讯方式**，运输层的功能可以概括为“三控制一寻址”：

- 差错控制：检测传输过程中数据的错误，并纠正错误。
- 流量控制：为了防止发送方将数据过快的发送，而接收方不能及时接收，从而导致数据丢失的现象。
- 连接控制：为了提供可靠的**端到端**通信，在传输数据时建立连接，在数据传输完毕关闭连接。
- 应用进程寻址：一台主机上可能会有多个应用进程，运输层要通过某种编址方法，能区分每个应用进程，将数据传输给正确的应用进程。

#### 网络层

网络层的基本传输单位是分组。在数据的发送方和接收方有可能隔着很多不同的网络，而网络层的主要的任务是为分组择路，选择一条合适的路径，使数据能够从发送方到达接收方。特别留意运输层是**点到点的通讯方式**。

#### 数据链路层

数据链路层的基本传输单位是帧。数据链路层是网络层和物理层的桥梁，在同一物理网络中，两个节点（主机与交换机）之间传输帧，数据链路层也涉及到一个寻址的问题，而在数据链路层是通过MAC地址的方式进行寻址的。数据链路层也有流量控制、差错控制、访问控制的功能。

#### 物理层

物理层的基本传输单位是比特。物理层更贴近硬件，比如网线。物理层的主要任务是将0,1比特流从物理链路的一端发送到另一端。

### 图片对比

![图片对比](./OSI-TCP-IP-model/1.png)

### TCP/IP模型

TCP/IP模型是OSI模型之后新提出的模型，一共四层：应用层、运输层、互联网层、网络接口层。

#### 应用层

TCP/IP模型与OSI模型的应用层功能基本一致，囊括应用层的应用协议，如HTTP、FTP、SMTP、POP3等。TCP/IP模型没有包含OSI中的表示层和会话层，在实际的联网实践中证明这两个层对于多数的应用程序没有多大的用处。

#### 运输层

TCP/IP模型的运输层也同样提供的是**端到端**的通讯。在TCP/IP的体系中，运输层提供两个非常重要的协议，分别是TCP和UDP。

- TCP：TCP是面向连接的，TCP协议在传输数据之前，会先建立连接，然后才能传输数据；在传输数据时，会进行差错控制，保证数据的可靠性，同时会进行流量控制，保证数据的传输速度。
- UDP：UDP是面向无连接的，UDP协议不能保证数据的可靠性，但是UDP协议效率比较高，传输的速度比较快，适合对数据安全性不高对速度高的服务，比如音频和视频。

#### 互联网层

互联网层相当于OSI模型的网络层，同样是为运输层交给它的数据择路，将数据发送给接收方。主要的协议是IP协议，而IP协议是无连接的数据报服务，也就是说IP协议其实是不可靠的服务，但是IP协议不负责去解决这些问题，而是交给TCP去解决。

#### 网络接口层

网络接口层相当于OSI模型的数据链路层和物理层，主机使用某种协议与具体的网络连接，能够传递IP数据报。

### 讲在后面的话

#### TCP/IP到底几层

TCP/IP是事实标准，分4层。OSI模型是国际标准，分7层。讲课的时候，一般把他们综合起来讲，就说是5层。他把网络接口层分开为数据链路层和物理层了。

OSI的七层协议体系结构的概念清楚，理论也比较完整，但它既复杂又不实用，TCP/IP体系结构则不同，它现在已经得到了非常广泛的应用，TCP/IP是一个四层的体系结构，它包含应用层、运输层、互联网层和网络接口层，不过从实质来讲，TCP/IP只有最上面的三层，因为最下面的网络接口层基本上和一般的通信链路的功能上没有多大差别，对于计算机网络来说，这一层并没有什么特别新的具体的内容，因此在学习计算机网络原理是往往采用折中的办法，即综合OSI和TCP/IP的优点，采用一种只有五层协议的体系结构。