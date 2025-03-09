---
title: 一键安装源码依赖包
date: 2023-10-14 12:44:13
categories: 小玩意儿
tags:
  - Linux
---

在某些条件限制下，经常会遇到源码安装的情况，尤其是对于新的机器来讲，从头梳理源码安装依赖包可是一件头疼的事情，所以整理了一些常见且常用的源码安装依赖包，以备不时之需。

```bash
yum install -y gcc make pcre pcre-devel zlib zlib-devel openssl openssl-devel libxml2 libxml2-devel
```

<!-- more -->

如果遇到一些报错信息，可以采用如下命令尝试解决：

```bash
yum install -y gcc make pcre pcre-devel zlib zlib-devel openssl openssl-devel libxml2 libxml2-devel --allowerasing --nobest
```