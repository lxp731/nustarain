---
title: 设置博客背景图片
date: 2023-07-17 21:02:33
categories: 博客搭建
tags:
  - 博客美化
---

### 修改NEXT的配置文件

我一直使用的是Next的主题，这个主题默认是可以自定义一些样式的。

1. 首先选择一张心仪的背景图片，添加到themes/next/source/images/xx.jpg。我建议图片的大小最好控制一下，最好控制在400k-500K左右，动辄几兆大小的背景图片网页加载起来会很吃力，非常影响实际体验。

2. 然后需要打开这个开关，也就是取消style这个注释

<!-- more -->

```yml
custom_file_path:
  #head: source/_data/head.njk
  #header: source/_data/header.njk
  #sidebar: source/_data/sidebar.njk
  #postMeta: source/_data/post-meta.njk
  #postBodyEnd: source/_data/post-body-end.njk
  #footer: source/_data/footer.swig
  #bodyEnd: source/_data/body-end.njk
  #variable: source/_data/variables.styl
  #mixin: source/_data/mixins.styl
  style: source/_data/styles.styl
  ```

3. 取消注释以后，创建这样的一个文件source/_data/styles.styl，需要注意的是，这个source是站点目录下的source，而不是主题目录下的source。

创建好之后，在文件插入以下代码：

```yml
body {
 	background:url(/images/xx.jpg);
 	background-repeat: no-repeat;
    background-attachment:fixed;
    background-position:100% 100%;
}
```

* background:url 为图片路径，也可以直接使用链接。
* background-repeat：若果背景图片不能全屏，那么是否平铺显示，充满屏幕
* background-attachment：背景是否随着网页上下滚动而滚动，fixed 为固定
* background-size：图片展示大小，这里设置 100%，100% 的意义为：如果背景图片不能全屏，那么是否通过拉伸的方式将背景强制拉伸至全屏显示。

重新生成一下配置，就会出现效果了。