---
title: 移除Ubuntu桌面的家目录文件夹
date: 2023-08-06 20:51:19
categories: 探索
tags:
  - Ubuntu
---

### 问题描述

由于中文版Ubuntu的系统在个人家目录会显示中文的文件夹（桌面，文档，照片等这些），因为在进入这些目录时需要先修改输入法语言，在使用了一段时间的Ubuntu后，感到实在费劲，所以索性将这些文件夹都改成了对应的英文名字，比如桌面对应“Desktop”，后来导致Ubuntu开机之后，家目录下的文件夹全部都显示到了桌面，真的是丑到极点。

后来经过一番的查找资料，终于找到了解决办法。

### 解决办法

1. 在Ubuntu系统中有一个文件夹管理着家目录的文件夹名字和家目录某种程度上的系统变量的关系。在这个文件夹中记录着系统变量和家目录的对应关系。

<!-- more -->

2. 可以直接查看这个文件`cat ~/.config/user-dirs.dirs`

```bash 折叠代码
# This file is written by xdg-user-dirs-update
# If you want to change or add directories, just edit the line you're
# interested in. All local changes will be retained on the next run.
# Format is XDG_xxx_DIR="$HOME/yyy", where yyy is a shell-escaped
# homedir-relative path, or XDG_xxx_DIR="/yyy", where /yyy is an
# absolute path. No other format is supported.
# 
XDG_DESKTOP_DIR="$HOME/桌面"
XDG_DOWNLOAD_DIR="$HOME/下载"
XDG_TEMPLATES_DIR="$HOME/模板"
XDG_PUBLICSHARE_DIR="$HOME/公共"
XDG_DOCUMENTS_DIR="$HOME/文档"
XDG_MUSIC_DIR="$HOME/音乐"
XDG_PICTURES_DIR="$HOME/图片"
XDG_VIDEOS_DIR="$HOME/视频"
```

3. 上面是我修改完之前的样子，在修改之后是这样的：

```bash 折叠代码
# This file is written by xdg-user-dirs-update
# If you want to change or add directories, just edit the line you're
# interested in. All local changes will be retained on the next run.
# Format is XDG_xxx_DIR="$HOME/yyy", where yyy is a shell-escaped
# homedir-relative path, or XDG_xxx_DIR="/yyy", where /yyy is an
# absolute path. No other format is supported.
# 
XDG_DESKTOP_DIR="$HOME/Desktop"
XDG_DOWNLOAD_DIR="$HOME/Downloads"
XDG_TEMPLATES_DIR="$HOME/Template"
XDG_PUBLICSHARE_DIR="$HOME/Public"
XDG_DOCUMENTS_DIR="$HOME/Document"
XDG_MUSIC_DIR="$HOME/Music"
XDG_PICTURES_DIR="$HOME/Picture"
XDG_VIDEOS_DIR="$HOME/Viedo"
```

4. 修改完这个配置文件，然后把家目录的对应文件夹的名字修改为与配置文件一致就OK了！

```bash
knight@knight:~/.ssh$ cd ~
knight@knight:~$ ls
aliyun  Desktop   Downloads  nustarain          Public    snap      Viedo
chrome  dingtalk  Music      package-lock.json  qq        sougou    vs_code
clash   Document  node       Picture            qq_music  Template  wechat
```

5. 关机，重启，就会发现桌面的家目录文件夹全都消失了。