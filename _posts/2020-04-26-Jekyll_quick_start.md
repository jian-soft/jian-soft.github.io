---
title: Jekyll快速开始教程
---


## Jekyll是什么

Jekyll是一个静态网站生成器。你只需要用makrdown撰写文本，Jekyll基于布局和模板将markdown转为静态网站。
Jekyll的官网是jekyllrb.com，名字中包含”rb”，可以看出这是一个用ruby开发的项目。
slogon（口号）是：将你的文本转换为静态博客网站

三大特点：
1. 简单：不需要数据库，不需要烦人地更新和安装，只要关注你的内容
2. 静态：基于Markdown、Liquid、HTML&CSS，构建可部署的静态站点
3. 博客友好：永久地址、分类、页面、文章以及自定义的布局设计，这些都是Jekyll的一等公民

## 快速开始教程

### 依赖的软件包

#### 1. Ruby
version >=2.5, 并且需要包含开发头文件，可以通过`ruby –v`查看ruby的版本。如果没有安装，通过下面命令安装(Ubuntu)：
```
apt install ruby-full
```

#### 2. RubyGem
简称gem，是Ruby的包管理工具，可以通过`gem –v`查看是否安装gem。ruby 1.9版本之后，gem是ruby标准库的一部分。即如果安装的ruby版本>1.9，则默认也安装了gem。
替换RubyGems的源为中国的镜像，加快国内访问速度。参考gems.ruby-china.com：
```
$ gem sources --add https://gems.ruby-china.com/ --remove https://rubygems.org/
$ gem sources -l
https://gems.ruby-china.com
# 确保只有 gems.ruby-china.com
```

#### 3. GCC和Make
可以通过`gcc –v; make –v`来确认是否安装。没安装的话通过下面命令安装：
```
apt install build-essential
```

### Ruby扫盲
Jekyll使用Ruby开发的，这里介绍下Ruby相关的术语。
1. Gems: 
	Gem就是打包了某个功能的代码，可以在Ruby项目中引用它。Jekyll本身就是一个Gem包，当然Jekyll也引用了其它Gem包
2. Gemfile: 
	Gemfile是一个你网站需要的Gem包清单。一个Gemfile示例如下：
```
source "https://rubygems.org"
gem "jekyll"
group :jekyll_plugins do
  gem "jekyll-feed"
  gem "jekyll-seo-tag"
end
```
3. Bundler: 
	Bundler安装Gemfile中定义的Gems。使用Gemfile和Bundler不是必须的，但是强烈推荐使用。因为这样可以保证在不同的环境中，Jekyll和Jekyll插件的版本是一样的。
	使用`gem install bundler`命令来安装Bundler。
	如果你使用Gemfile，则首先需要运行`bundle install`来安装gems。然后执行`bundle exec jekyll serve`来运行网站，这里的bundle exec能保证你使用的Jekyll版本是Gemfile里定义的。如果不使用Gemfile，则可以直接执行`jekyll serve`。

### 快速开始
1. 通过gem安装jekyll和bundler
```
gem install jekyll bundler
```
2. 创建一个新的jekyll站点
```
jekyll new myblog
```
3. 构建站点并启动一个本地web服务器
```
cd myblog
bundle exec jekyll serve
```
在浏览器访问http://localhost:4000

`jekyll serve`命令启动的web server是不能远程访问的，只能本地访问。jekyll serve指定server的ip地址时，则可以远程访问这个站点，命令如下：
```
jekyll serve –H 45.113.0.36
```

