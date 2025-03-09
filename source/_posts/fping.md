---
title: 源码安装 fping 命令
date: 2023-10-14 13:12:58
categories: 小玩意儿
tags:
  - Linux
---

### 安装步骤

1. 下载源码包

连接网络在线下载

```bash
wget http://fping.org/dist/fping-3.15.tar.gz
```

<!-- more -->

或者使用我自己准备好的源码包，目前存放在百度网盘里，[**点击跳转**](https://pan.baidu.com/s/1HF8KQNhvoxPca6ic5m14pg?pwd=ykb6)。

2. 解压源码包

```bash
tar -xf fping-3.15.tar.gz && cd fping-3.15
```

3. 执行 configure 脚本检测环境

```bash
./configure
```

这一步既可以根据提示信息来按需安装为安装的依赖包，也可以参照我之前的博文[**一键安装源码依赖包**](https://nustarain.gitee.io/2023/10/14/SoucecodeInstallFping/)，进行无脑安装。

4. 最行操作

```bash
make && make install
```

5. 验证安装

```bash
fping -v
```