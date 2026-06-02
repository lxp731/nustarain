---
title: 设置博客背景的透明度
date: 2023-09-09 17:39:30
categories: 博客搭建
tags:
  - 博客美化
---

之前在[设置博客背景图片](https://nustarain.gitee.io/2023/07/17/BGPic/)的过程中，其实已经间接实现过设置博客背景透明度的功能了。   
因为已经设置了博客背景“小飞棍”的特效，如果再把博客背景设置为透明的话，估计很多人会把持不住，在博客上玩起“小飞棍”吧。所以，就一直没有把博客背景设置为透明。

直到前段时间有位朋友跟我说，如果是透明的，效果可能会更好一些。虽说当时我也跟她说过我的顾虑。但是我也打算尝试一下透明效果，毕竟之前设置的时候真的很美。

闲话少叙，教程开始。

<!-- more -->

### 配置步骤

1. 取消注释

和配置背景图片时的操作差不多，打开`themes\next\_config.yml`文件。   
<kbd>CTRL</kbd>+<kbd>F</kbd>查找关键字“custom_file_path”(如果你使用的是VS-CODE编辑器)。   
取消`style: source/_data/styles.styl`注释。

```yml 折叠代码
custom_file_path:
  #head: source/_data/head.njk
  #header: source/_data/header.njk
  #sidebar: source/_data/sidebar.njk
  #postMeta: source/_data/post-meta.njk
  #postBodyEnd: source/_data/post-body-end.njk
  footer: source/_data/footer.swig
  bodyEnd: source/_data/body-end.njk
  variable: source/_data/variables.styl
  #mixin: source/_data/mixins.styl
  style: source/_data/styles.styl
```

PS：我这里取消注释的比较多，因为设置的比较多，单独说设置透明度的话，只需要取消注释`style`即可。

2. 按照`style`的路径添加相应的文件，如果当前不存在此文件的话。如果已经存在的话，添加以下配置。

```yml 折叠代码
//文章背板的颜色rgb
.main-inner > .sub-menu, .main-inner > .post-block, .main-inner > .tabs-comment, .main-inner > .comments, .main-inner > .pagination{
	background: #f5f5f56b;		//此处使用十六进制颜色代码,也可以使用rgba进行调色,实际效果为白色透明色底板,rgba的第四参数即为透明度
}

//修改主体字体颜色
body{				
  color: #000;		//纯黑
}

//标题颜色
.posts-expand .post-title-link {
    color: #000;				//首页文章标题颜色， （默认为灰辨识度不高）
}

//标题下的日期颜色
.posts-expand .post-meta-container {
    color: #880000;				//此处修改为红色,可自行调用rgb调色
}

//侧边框的透明度设置
.sidebar {
  opacity: 0.7;
}

//菜单栏的调色
.header-inner {		
  background: rgba(255,0,255,0.7);
}y

//搜索框透明
.popup {		
  opacity: 0.7;
}

//主体背景透明
.main-inner {
    background-color: rgba(255, 255, 255, 0);
    padding: 0px 40px 40px 40px;  //调整组件位置
}
```

PS：各项配置说明都标注得很清楚，按照自己的喜好进行设置即可。

### 补充

已经取消注释的文件对应的功能和教程链接。

|文件|功能|
|:---:|:---:|
|footer|**[背景"小飞棍"](https://nustarain.gitee.io/2023/07/17/FlyLine/)**|
|bodyEnd|**[折叠代码](https://nustarain.gitee.io/2023/09/09/blog-FoldCode/)**|
|variable|**[设置圆角](https://nustarain.gitee.io/2023/09/09/blog-fillet/)**|
|style|**[背景图片](https://nustarain.gitee.io/2023/07/17/BGPic/)**、**[博客透明度](https://nustarain.gitee.io/2023/09/09/blog-transparency/)**、**[折叠代码](https://nustarain.gitee.io/2023/09/09/blog-FoldCode/)**|