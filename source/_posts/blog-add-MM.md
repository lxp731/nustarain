---
title: 博客添加视频方法的总结
date: 2023-12-16 17:14:37
categories: 博客搭建
tags:
  - 博客美化
---

博客添加视频目前我掌握的一共有两种办法，一种是使用 [**hexo-tag-dplayer 插件**](https://github.com/MoePlayer/hexo-tag-dplayer)，这是对于使用 Hexo 用户多出来的一个选项，但是多出来的这个选项，实际体验也不怎么样。

### hexo-tag-dplayer

使用 Hexo-tag-dplayer 可以使用以下代码进行添加视频：

<!-- more -->

```bash
{% dplayer 
  "url=https://dpv.videocc.net/a2ad892af4/8/a2ad892af4a82f0ad4f5062526946108_1.mp4?pid=1694175956521X1590085" 
  "screenshot" 
  "loop=false" 
  "preload=auto"
  "volume=0.4"
  "id=46190A32F63DFF2CF0A3BB0F3293636C" 
  "api=https://api.prprpr.me/dplayer/" 
  "addition=https://api.prprpr.me/dplayer/v3/bilibili?aid=17150441" 
%} 
```

唯一需要自己完成的就是关于视频地址的获取，我这里使用的是[酷播云](https://v.cuplayer.com/)，在国内还是比较快的。

但是经过我使用发现，这个插件在网页中第一次加载时加载不出来视频，需要在进入网页后再进行一次刷新，有时候一篇文章看完了都不知道竟然还有一个视频。

具体的解决办法我并没有深究，好在发现了另一个办法。

[**点击这里，查看效果**](https://nustarain.gitee.io/2023/09/08/tiangangfu/) 视频在最下面，看不到的话，刷新一下。

### iframe

除了使用 hexo-tag-dplayer 还有 H5 中的 iframe 标签也不错。可以通过以下代码引入：

```bash
<iframe style='width: 600px;height: 338px' frameborder='no' allowfullscreen mozallowfullscreen webkitallowfullscreen src='https://dpv.videocc.net/a2ad892af4/8/a2ad892af4a82f0ad4f5062526946108_1.mp4?pid=1694175956521X1590085'></iframe>
```

也是直接替换掉 src 的内容就可以了。

[**点击这里，查看效果**](https://liuxpblog.eu.org/2023/09/06/TianGang/)

### 嵌入代码

嵌入代码这个功能通常是有别的网站提供的，据我所知大部分视频网站都没有这个功能，YouTube 的嵌入代码做的还可以，哔哩哔哩也有，但是非常吝啬，清晰度非常次，必须要求登录，如果要求登录的话，还不如直接去官网登录观看呢。

![嵌入代码](./blog-add-MM/1.png)

```bash
<iframe src="//player.bilibili.com/player.html?aid=922182547&bvid=BV1Uu4y1u7NQ&cid=1364298943&p=1" 
        scrolling="no" 
        border="0" 
        frameborder="no" 
        framespacing="0" 
        allowfullscreen="true"> 
</iframe>
```

效果如下：

<iframe src="//player.bilibili.com/player.html?aid=922182547&bvid=BV1Uu4y1u7NQ&cid=1364298943&p=1" 
        scrolling="no" 
        border="0" 
        frameborder="no" 
        framespacing="0" 
        allowfullscreen="true"> 
</iframe>