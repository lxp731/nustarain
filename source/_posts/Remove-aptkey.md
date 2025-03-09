---
title: 修复Ubuntu中的“Key is stored in legacy trusted.gpg keyring”问题
date: 2023-08-06 21:46:38
categories: 探索
tags:
  - Ubuntu
---

在Ubuntu下载软件时，经常会安装一些存储秘钥，时间一长就会有一些过期的，不能用的，经常会在`apt udate`时进行检测，卡着很长时间，最后进行警告，非常浪费时间，而且对于强迫症患者来讲，提示警告和提示报错没什么区别，必须解决。

### 解决办法

* 报错信息

```bash
有 44 个软件包可以升级。请执行 ‘apt list --upgradable’ 来查看它们。
W: https://community-store-packages.deepin.com/appstore/dists/eagle/InRelease: 密钥存储在过时的 trusted.gpg 密钥环中（/etc/apt/trusted.gpg），请参见 apt-key(8) 的 DEPRECATION 一节以了解详情。
W: 无法下载 https://typora.io/linux/./InRelease  Could not wait for server fd - select (11: 资源暂时不可用) [IP: 2a03:2880:f10d:183:face:b00c:0:25de 443]
W: 部分索引文件下载失败。如果忽略它们，那将转而使用旧的索引文件。
```
<!-- more -->

这一共有两个警告，第一个是提示有过期的存储秘钥，第二个是索引文件下载失败。

* 解决索引文件下载失败

注意索引文件的关键字有`typora`，进入存储索引文件的目录`/etc/apt/sources.list.d/`，把相关的文件直接删除即可。

```bash
knight@knight:~/wechat$ cd /etc/apt/sources.list.d/
knight@knight:/etc/apt/sources.list.d$ ls
deepin_appstore.list       google-chrome.list.save       typora.list       vscode.list.save
deepin_appstore.list.save  tickstep-aliyunpan.list       typora.list.save  winehq-focal.sources
google-chrome.list         tickstep-aliyunpan.list.save  vscode.list
knight@knight:/etc/apt/sources.list.d$ sudo rm -rf typora.list*
knight@knight:/etc/apt/sources.list.d$ ls
deepin_appstore.list       google-chrome.list.save       vscode.list
deepin_appstore.list.save  tickstep-aliyunpan.list       vscode.list.save
google-chrome.list         tickstep-aliyunpan.list.save  winehq-focal.sources
```

* 解决有过期的存储秘钥

解决完索引文件的问题之后，警告就变成了：

```bash
有 44 个软件包可以升级。请执行 ‘apt list --upgradable’ 来查看它们。
W: https://community-store-packages.deepin.com/appstore/dists/eagle/InRelease: 密钥存储在过时的 trusted.gpg 密钥环中（/etc/apt/trusted.gpg），请参见 apt-key(8) 的 DEPRECATION 一节以了解详情。
```

1. 首先先查看一下系统有多少存储秘钥

```bash 折叠代码
knight@knight:~/nustarain$ sudo apt-key list
[sudo] knight 的密码： 
Warning: apt-key is deprecated. Manage keyring files in trusted.gpg.d instead (see apt-key(8)).
/etc/apt/trusted.gpg
--------------------
pub   rsa2048 2014-12-16 [SC]
      6BDB FE94 72C9 961F 4C19  73A1 4259 56BB 3E31 DF51
uid             [ 未知 ] pkg-builder <pkg-builder@packages.linuxdeepin.com>
sub   rsa2048 2014-12-16 [E]

pub   rsa2048 2019-11-21 [SC]
      1D54 8EFE B9FA 97F2 FFEC  C7FE 1C30 362C 0A53 D5BB
uid             [ 未知 ] appstore (appstore key) <appstore@deepin.com>
sub   rsa2048 2019-11-21 [E]
sub   rsa2048 2019-11-21 [E]

/etc/apt/trusted.gpg.d/appstore.gpg
-----------------------------------
pub   rsa2048 2019-11-21 [SC]
      1D54 8EFE B9FA 97F2 FFEC  C7FE 1C30 362C 0A53 D5BB
uid             [ 未知 ] appstore (appstore key) <appstore@deepin.com>
sub   rsa2048 2019-11-21 [E]
sub   rsa2048 2019-11-21 [E]

/etc/apt/trusted.gpg.d/google-chrome.gpg
----------------------------------------
pub   rsa4096 2016-04-12 [SC]
      EB4C 1BFD 4F04 2F6D DDCC  EC91 7721 F63B D38B 4796
uid             [ 未知 ] Google Inc. (Linux Packages Signing Authority) <linux-packages-keymaster@google.com>
sub   rsa4096 2021-10-26 [S] [有效至：2024-10-25]
sub   rsa4096 2023-02-15 [S] [有效至：2026-02-14]

/etc/apt/trusted.gpg.d/microsoft.gpg
------------------------------------
pub   rsa2048 2015-10-28 [SC]
      BC52 8686 B50D 79E3 39D3  721C EB3E 94AD BE12 29CF
uid             [ 未知 ] Microsoft (Release signing) <gpgsecurity@microsoft.com>

/etc/apt/trusted.gpg.d/tickstep-packages-archive-keyring.gpg
------------------------------------------------------------
pub   rsa4096 2022-07-30 [SCEA]
      071D E06F 6BCE 212C 5483  CECF 3D4C 35B0 8026 4AA9
uid             [ 未知 ] tickstep <tickstep@outlook.com>

/etc/apt/trusted.gpg.d/ubuntu-keyring-2012-cdimage.gpg
------------------------------------------------------
pub   rsa4096 2012-05-11 [SC]
      8439 38DF 228D 22F7 B374  2BC0 D94A A3F0 EFE2 1092
uid             [ 未知 ] Ubuntu CD Image Automatic Signing Key (2012) <cdimage@ubuntu.com>

/etc/apt/trusted.gpg.d/ubuntu-keyring-2018-archive.gpg
------------------------------------------------------
pub   rsa4096 2018-09-17 [SC]
      F6EC B376 2474 EDA9 D21B  7022 8719 20D1 991B C93C
uid             [ 未知 ] Ubuntu Archive Automatic Signing Key (2018) <ftpmaster@ubuntu.com>
```

2. 可以看到有很多秘钥，然后在报错信息里面找关键字，发现有`deepin`关键字，然后使用 grep 查找，可以筛选出来，符合条件的就只有两个。

```bash 折叠代码
/etc/apt/trusted.gpg
--------------------
pub   rsa2048 2014-12-16 [SC]
      6BDB FE94 72C9 961F 4C19  73A1 4259 56BB 3E31 DF51
uid             [ 未知 ] pkg-builder <pkg-builder@packages.linuxdeepin.com>
sub   rsa2048 2014-12-16 [E]

pub   rsa2048 2019-11-21 [SC]
      1D54 8EFE B9FA 97F2 FFEC  C7FE 1C30 362C 0A53 D5BB
uid             [ 未知 ] appstore (appstore key) <appstore@deepin.com>
sub   rsa2048 2019-11-21 [E]
sub   rsa2048 2019-11-21 [E]
```

3. 将这两个秘钥逐一导出即可，导出时用到秘钥的后8位作为标记（去掉空格）。

```bash
knight@knight:/etc/apt/trusted.gpg.d$ sudo apt-key export 0A53D5BB | sudo gpg --dearmour -o /etc/apt/trusted.gpg.d/appstore.gpg
Warning: apt-key is deprecated. Manage keyring files in trusted.gpg.d instead (see apt-key(8)).
```

上面这条命令的意思是：导出秘钥后8位为`0A53D5BB`的秘钥，导出到`/etc/apt/trusted.gpg.d/`目录下，并且命名为`appstore.gpg`。

然后去存储秘钥的目录下验证，发现存在这样的一个文件。

```bash
knight@knight:/etc/apt/trusted.gpg.d$ ls /etc/apt/trusted.gpg.d/
appstore.gpg       microsoft.gpg                          ubuntu-keyring-2012-cdimage.gpg
google-chrome.gpg  tickstep-packages-archive-keyring.gpg  ubuntu-keyring-2018-archive.gpg
```

4. 最后，`sudo apt-key list`查看导出的秘钥并不会消失，但是执行`sudo apt update`不会再报警告了。

``` bash 
获取:18 http://mirrors.aliyun.com/ubuntu jammy-security/universe amd64 DEP-11 Metadata [39.9 kB] 
命中:19 https://dl.winehq.org/wine-builds/ubuntu focal InRelease                     
命中:20 http://file.tickstep.com/apt aliyunpan InRelease 
已下载 3,765 kB，耗时 6秒 (654 kB/s)
正在读取软件包列表... 完成
正在分析软件包的依赖关系树... 完成
正在读取状态信息... 完成                 
有 11 个软件包可以升级。请执行 ‘apt list --upgradable’ 来查看它们。
knight@knight:~/nustarain$ 
```