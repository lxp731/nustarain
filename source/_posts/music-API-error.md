---
title: 出现"An auido error has occurred,player will skip forward in 2 seconds."错误！
date: 2023-09-15 12:46:12
categories: 博客搭建
tags:
  - 博客美化
---

### 问题描述

不知道怎么搞的，前几天刚刚弄好的博客音乐播放器，今天再次打开的时候，播放页面老是在弹出报错“An auido error has occurred,player will skip forward in 2 seconds.”。因为在将歌单放在博客之前，为了防止因为非VIP用户的正常播放，已经将歌单所有的音乐都改成了免费音乐，所以一般不会出现权限的问题，但是还是出现了这个问题，百思不得其解。

<!-- more -->

### 问题探索

再网页用F12审查之后，因为也不是专业的，大概看出是因为API的调用出现了问题。所以在回到之前调用的歌单，我是用的鹅厂音乐，所以大概率是鹅厂的API调用的问题。   

为了验证这个猜想，索性把网抑云的歌单拿来实验了一下，还真成功了。所以原因找到了，但是修改鹅厂的API调用还真的不会，希望大佬可以将错误复现，然后着手解决吧。

[**之前搭建音乐播放器的步骤链接**](https://nustarain.gitee.io/2023/09/07/hexo-music/)