---
title: Jekyll详细教程
---

{% raw %}
## 设置
### 安装
上一篇[《Jekyll快速开始教程》](/2020/04/26/Jekyll_quick_start.html)中使用的是jekyll自带的new命令来创建网站，本篇我们从头开始一步一步建立Jekyll网站。
使用下面命令创建一个新的Gemfile，用来管理项目的依赖:
```
bundle init
```

编辑Gemfile，增加jekyll
```
gem "jekyll"
```

运行bundle来安装jekyll。
之后通过`bundle exec jekyll`来保证使用的jekyll版本是由Gemfile指定的。

### 创建站点
先为你网站创建一个文件夹，你可以起任意你喜欢的名字。这里我们创建一个名叫”root”的文件夹。
在root目录下创建第一个文件，index.html，内容如下：
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Home</title>
  </head>
  <body>
    <h1>Hello World!</h1>
  </body>
</html>
```
### 构建
Jekyll时一个静态网站生成器，所以我们需要在访问它之前构建它。你可以在网站根目录下运行如下两个命令构建它：
1. `jekyll build`: 构建网站并在目录_site下面生成静态站点
2. `jekyll serve`: 和build相同，同时做任何修改时都会触发rebuild，并且在localhost:4000起一个webserver。

## Liquid
Liquid是一个让Jekyll变得更有意思的地方。Liquid是一个模板语言，有三个主要部分：objects, tags, filters

### Objects
Objects告诉Liquid从哪显示内容。Objects是由双中括号括起来的内容。例如：
```
{{ page.title }}
```
在页面上输出一个叫page.title变量的值

### Tags
Tags创建模板的逻辑和控制流。由中括号加百分号标注。例如：
```
{% if page.show_sidebar %}
  <div class=”sidebar”>
    sidebar content
  </div>
{% endif %}
```

如果变量page.show_sidebar的值为true，则输出sidebar。

### Filters
Filters改变Liquid对象输出的内容。在Liquid输出对象中使用，用”|”分隔。例如：
```
{{ "hi" | capitalize }}
```
输出Hi。
使用Liquid
下面开始动手，修改index.html <h1>那行内容如下：
```
<h1>{{ "Hello World!" | downcase }}</h1>
```

要让Jekyll处理Liquid模板，需要在页面顶端加上前页(front matter)。
```
---
# front matter tells Jekyll to process Liquid
---
```
现在运行`jekyll serve`，浏览器访问站点，”Hello World!”变成了”hello world”。

## 前页

### 前页

前页（front matter）一段YAML标记语言片段，在文件开始，位于2个三横杠之间。前页用来设置这个页面的变量。例如：
```
---
my_number: 5
---
```

Liquid可以通过page对象访问前页中的变量，比如要输出上面的变量my_number的值，可以用如下方式：
```
{{ page.my_number }}
```

### 使用前页

让我们使用前页来修改网站的title。编辑index.html如下：
```html
---
title: Home
---
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{{ page.title }}</title>
  </head>
  <body>
    <h1>{{ "Hello World!" | downcase }}</h1>
  </body>
</html>
```

注意，为了能让jekyll处理页面中的Liquid标记，必须要在页面中包含前页。最小的前页片段就是2个三横杠。
```
---
---
```

## 布局

一般一个网站会有很多页面，如果你想修改每个页面的<head>样式，你需要每个页面都去修改。使用布局是更好的选择。布局是包含公共内容的模板。它们在_layouts目录下。

### 创建布局

让我们创建第一个布局_layouts/default.html，内容如下：
```
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{{ page.title }}</title>
  </head>
  <body>
    {{ content }}
  </body>
</html>
```

你会注意到这里的内容几乎和index.html一致。除了两个不同点：没有前页；<body>的内容被{{ content }}代替。content是一个特殊的变量，表示要渲染的页面的内容。
要在index.html中使用这个布局，需要在前页中设置layout变量。布局会将页面的内容包起来，所以index.html只需要如下：
```
---
layout: default
title: Home
---
<h1>{{ "Hello World!" | downcase }}</h1>
```

### about页面
让我们来创建about页面。没有布局前，我们需要复制整个index.html然后对其修改。有了布局之后，并且使用markdown，about.md内容如下：
```
---
layout: default
title: About
---
# About page
This page tells you a little bit about me.
```

现在，访问http://localhost:4000/about.html，可以看到新创建的这个about页面了！
恭喜你，你的网站现在有两个页面了。但是，如何在两个页面之间跳转呢，继续往下看。

## 引用
当前的页面中还没有导航栏。导航栏应该在每个页面中，所以将导航栏放到layout中是一个正确的做法。除了直接放到layout中，引用也是一种方法，本节让我们来学习一下引用。

### 引用的关键字
引用的关键字”include”可以让你在文件中引用_includes目录下的内容。引用对页面中重复出现的代码片段很有用，可以提高可读性。
导航栏的代码可能会变得很复杂，把它放到include中是一个好的做法。

### 使用引用
创建_includes/navigation.html，内容如下：
```
<nav>
  <a href="/">Home</a>
  <a href="/about.html">About</a>
</nav>
```

在_layouts/default.html中使用引用：
```
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{{ page.title }}</title>
  </head>
  <body>
  </body>
</html>
```
现在，访问http://localhost:4000，可以在两个页面之间切换。

### 高亮当前页面
更近一步，让我们丰富导航栏的表现，高亮当前所在的页面。
navigation.html需要知道当前页面的URL，以便根据URL变换样式。Jekyll提供page.url来获取当前页面的URL。
使用page.url，检查当前url和当前页面是否匹配，如果匹配采用红色样式：
```
<nav>
  <a href="/" {% if page.url == "/" %}style="color: red;"{% endif %}>
    Home
  </a>
  <a href="/about.html" {% if page.url == "/about.html" %}style="color: red;"{% endif %}>
    About
  </a>
</nav>
```
现在，访问http://localhost:4000，可以看到导航栏的当前页面是红色。

## 数据文件

Jekyll支持从_data目录下的YAML、JSON、CSV文件中加载数据。数据文件是一个很好的分离内容和代码的方式，从而使得网站更易维护。
本节中，你将会在一个数据文件中存储导航的内容，然后在导航代码片段中访问这个数据文件。

### 使用数据文件
YAML是Ruby生态中一种常用的数据格式。创建_data/navigation.yml，内容如下：
```
- name: Home
  link: /
- name: About
  link: /about.html
```
Jekyll使你可以通过site.data.navigation变量访问这些数据。相对于上一节直接在_includes/navigation.html编写每个链接，可以通过迭代数据的方式：
```
<nav>
  {% for item in site.data.navigation %}
    <a href="{{ item.link }}" {% if page.url == item.link %}style="color: red;"{% endif %}>
      {{ item.name }}
    </a>
  {% endfor %}
</nav>
```

现在，访问localhost:4000，输出内容和上一节完全一样。但是优点是以后可以很方便增加导航栏内容，只需要修改数据文件，不需要修改html内容。

## 资产文件

在Jekyll中使用CSS JS images等资产文件非常直接，将它们放到网站目录下即可。通常用一下目录结构放置资产文件
```
.
├── assets
│   ├── css
│   ├── images
│   └── js
...
```

### SASS
直接在_includes/navigation.html中使用样式不是一种好的做法，让我们将样式用class代替：
```
<nav>
  {% for item in site.data.navigation %}
    <a href="{{ item.link }}" {% if page.url == item.link %}class="current"{% endif %}>{{ item.name }}</a>
  {% endfor %}
</nav>
```
你可以用标准的CSS文件来定义样式，这里我们将更进一步，使用Sass。Sass是一种CSS扩展语言，更详细介绍可访问sass-lang.com。Jekyll支持Sass。
首先创建一个Sass文件assets/css/styles.scss，内容如下：
```
---
---
@import "main";
```
空的前页标记表示此文件需要Jekyll处理。@import“main”表示在sass目录下寻找mian.sass（默认sass目录是_sass）。
创建Sass文件_sass/main.scss，内容如下：
```
.current {
  color: green;
}
```
在布局中引用刚定义的样式。编辑_layouts/default.html，修改<head>，修改后如下：
```
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{{ page.title }}</title>
    <link rel="stylesheet" href="/assets/css/styles.css">
  </head>
  <body>
  </body>
</html>
```
这里的styles.css有Jekyll根据styles.sass生成。
现在，访问localhost:4000，查看结果。

## 博客

你可能好奇没有数据库怎么建立一个博客网站。实际上，在Jekyll风格中，博客只由文本文件驱动。

### 文章

博客文章在_posts目录下。文章的标题有特殊格式：日期，标题，文件名扩展。
创建你的第一篇文章_posts/2018-08-20-bananas.md，内容如下：
```
---
layout: post
author: jill
---
A banana is an edible fruit – botanically a berry – produced by several kinds
of large herbaceous flowering plants in the genus Musa.

In some countries, bananas used for cooking may be called "plantains",
distinguishing them from dessert bananas. The fruit is variable in size, color,
and firmness, but is usually elongated and curved, with soft flesh rich in
starch covered with a rind, which may be green, yellow, red, purple, or brown
when ripe.
```

### 布局

post布局还不存在，创建_layouts/post.html内容如下：
```
---
layout: default
---
<h1>{{ page.title }}</h1>
<p>{{ page.date | date_to_string }} - {{ page.author }}</p>

{{ content }}
```

这是一个布局继承的例子。post布局输出自定义的内容，然后这些内容由default布局包围。

### 列举文章
现在还没入口访问文章，通常博客网站有一个页面列举所有的文章。
Jekyll用site.posts表示所有的文章。
在根目录下创建blog.html，内容如下：
```
---
layout: default
title: Blog
---
<h1>Latest Posts</h1>

<ul>
  {% for post in site.posts %}
    <li>
      <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
      {{ post.excerpt }}
    </li>
  {% endfor %}
</ul>
```
说明：<br/>
`post.url`: 由Jekyll自动设置为文章的生成路径
`post.title`: 由文件名提取
`post.excerpt`: 默认是文章的第一段，excerpt本事是摘录的意思
在导航栏中增加博客页面，编辑_data/navigation.yml内容如下：
```
- name: Home
  link: /
- name: About
  link: /about.html
- name: Blog
  link: /blog.html
```

### 更多文章
一个博客只有一篇文章是无趣的，让我们在创建两篇文章。
_posts/2018-08-21-apples.md:
```
---
layout: post
author: jill
---
An apple is a sweet, edible fruit produced by an apple tree.

Apple trees are cultivated worldwide, and are the most widely grown species in
the genus Malus. The tree originated in Central Asia, where its wild ancestor,
Malus sieversii, is still found today. Apples have been grown for thousands of
years in Asia and Europe, and were brought to North America by European
colonists.
```

_posts/2018-08-22-kiwifruit.md:
```
---
layout: post
author: ted
---
Kiwifruit (often abbreviated as kiwi), or Chinese gooseberry is the edible
berry of several species of woody vines in the genus Actinidia.

The most common cultivar group of kiwifruit is oval, about the size of a large
hen's egg (5–8 cm (2.0–3.1 in) in length and 4.5–5.5 cm (1.8–2.2 in) in
diameter). It has a fibrous, dull greenish-brown skin and bright green or
golden flesh with rows of tiny, black, edible seeds. The fruit has a soft
texture, with a sweet and unique flavor.
```

现在，访问localhost:4000, 可以访问每篇文章了。下一节，我们为每个作者创建一个页面。

## 集合
让我们给每一个作者一个包含简介和文章的页面。这就要用到集合，集合和文章类似，但是集合不需要按照日期分组。

### 配置
你需要告诉Jekyll如何设置集合，通过_config.yml（默认在根目录）配置。
在根目录下创建_config.yml，内容如下：
```
collections:
  authors:
```

### 添加作者
文档-集合的各个元素位于_*collection_name*目录下，本例中，位于_authors目录下。
对每一个作者创建一个文档：
_authors/jill.md:
```
---
short_name: jill
name: Jill Smith
position: Chief Editor
---
Jill is an avid fruit grower based in the south of France.
```

_authors/ted.md:
```
---
short_name: ted
name: Ted Doe
position: Writer
---
Ted has been eating fruit since he was baby.
```

### 人物页面
让我们添加一个列出所有作者的页面，可以通过site.authors访问集合。
创建staff.html，然后遍历site.authors来输出所有的作者：
```
---
layout: default
title: Staff
---
<h1>Staff</h1>

<ul>
  {% for author in site.authors %}
    <li>
      <h2>{{ author.name }}</h2>
      <h3>{{ author.position }}</h3>
      <p>{{ author.content | markdownify }}</p>
    </li>
  {% endfor %}
</ul>
```
因为author.content是markdown格式，所以需要markdownify转义成html。当用{{ content }}来输出内容时，对markdown的转义是自动的。
修改导航栏，添加人物页面，_data/navigation.yml：
```
- name: Home
  link: /
- name: About
  link: /about.html
- name: Blog
  link: /blog.html
- name: Staff
  link: /staff.html
```

### 输出页面
默认地，集合不会为每个文档输出页面。这里我们想为每个作者生成一个页面，让我们调整下集合的配置。
修改_config.yml如下：
```
collections:
  authors:
    output: true
```

可以通过author.url链接到输出的页面。在staff.html中添加链接，修改<h2>标签内容如下：
```
<h2><a href="{{ author.url }}">{{ author.name }}</a></h2>
```

像文章页面布局一样，需要为作者页面创建布局。_layouts/author.html：
```
---
layout: default
---
<h1>{{ page.name }}</h1>
<h2>{{ page.position }}</h2>

{{ content }}
```

### 前页默认设置
现在需要为每个作者页面配置author布局，可以像posts一样修改_author下的每个文件添加布局。
我们真正想要的是文章自动使用文章的布局，作者自动使用作者的布局，其它的使用default布局。
在_config.yml添加默认布局设置：
```
collections:
  authors:
    output: true

defaults:
  - scope:
      path: ""
      type: "authors"
    values:
      layout: "author"
  - scope:
      path: ""
      type: "posts"
    values:
      layout: "post"
  - scope:
      path: ""
    values:
      layout: "default"
```
现在，你可以移除所有页面的前页中移除掉布局设置。

### 列举作者文章
让我们在作者页面中列举出作者的所有文章。通过匹配作者的short_name和文章的author来完成。根据文章的作者过滤出文章列表，然后遍历这个列表输出作者的所有文章。
修改_layouts/author.html如下：
```
---
layout: default
---
<h1>{{ page.name }}</h1>
<h2>{{ page.position }}</h2>

{{ content }}

<h2>Posts</h2>
<ul>
  {% assign filtered_posts = site.posts | where: 'author', page.short_name %}
  {% for post in filtered_posts %}
    <li><a href="{{ post.url }}">{{ post.title }}</a></li>
  {% endfor %}
</ul>
```

### 链接到作者页面
现在每个作者都有了一个页面，让我们给文章中的作者添加链接指向作者页面。
修改_layouts/post.html，内容如下：
```
---
layout: default
---
<h1>{{ page.title }}</h1>

<p>
  {{ page.date | date_to_string }}
  {% assign author = site.authors | where: 'short_name', page.author | first %}
  {% if author %}
    - <a href="{{ author.url }}">{{ author.name }}</a>
  {% endif %}
</p>

{{ content }}
```

现在，访问localhost:4000，查看结果是不是符合预期。

## 部署
最后一节是部署。

### 插件
Jekyll插件可以让你创建定制生成的内容。有三个几乎所有Jekyll网站都会用到的官方插件。
1. jekyll-sitemap
2. jekyll-feed 为你的博客创建RSS feed
3. jekyll-seo-tag 


要使用这些插件，首先需要将它们添加到Gemfile中。如果将它们放到jekyll-plugins组中，它们将被Jekyll依赖。

```
source 'https://rubygems.org'

gem 'jekyll'

group :jekyll_plugins do
  gem 'jekyll-sitemap'
  gem 'jekyll-feed'
  gem 'jekyll-seo-tag'
end
```
然后在_config.yml中添加如下行：
```
plugins:
  - jekyll-feed
  - jekyll-sitemap
  - jekyll-seo-tag
```
通过`bundle update`命令安装这些插件。

需要在_layouts/default.html添加tag来使用jekyll-feed和jekyll-seo-tag：
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{{ page.title }}</title>
    <link rel="stylesheet" href="/assets/css/styles.css">
    {% feed_meta %}
    {% seo %}
  </head>
  <body>
  </body>
</html>
```

### 环境
可以通过JEKYLL_ENV环境变量来指定环境类型，默认JEKYLL_ENV=development。可以通过jekyll.enviroment来获取环境类型。于是，可以通过下面代码，只在生产环境使用分析脚本：
```
{% if jekyll.environment == "production" %}
  <script src="my-analytics-script.js"></script>
{% endif %}
```

### 部署
最简单的部署方法就是执行构建命令：
```
JEKYLL_ENV=production bundle exec jekyll build
```
然后将生成的_site目录复制到你的服务器中。
更好的方法是通过持续继承或三方服务来自动化部署。后面会有一篇教程，介绍在Github Pages中使用Jekyll。

{% endraw %}


