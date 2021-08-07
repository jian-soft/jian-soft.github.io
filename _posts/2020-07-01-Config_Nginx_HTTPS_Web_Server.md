---
title: 配置Nginx静态HTTPS Web服务器
---
## Nginx介绍

Nginx(engine x)是一个高性能的HTTP服务器和反向代理服务器。
这里的HTTP服务器就是静态web服务器。

反向代理服务器是什么呢？反向代理是相对正向代理而言的。正向代理：代理服务器代替客户端访问远端服务器，即客户端的代理。反向代理：代理服务器代替远端服务器接受客户端的请求，远端服务器的代理。反向代理是一个将客户端请求再分发的行为，当远端服务器有多个物理实体时，反向代理可以实现负载均衡，或者将不同的客户端请求分发到不同的服务器。

Nginx运行时由一个主线程和几个工作线程组成，主线程主要是加载和验证配置文件、维护工作线程，工作线程处理实际的请求。Nginx采用基于事件驱动的模型和依赖OS的接口在工作线程中分发请求。

### 安装Nginx

小白安装方式就是二进制源直接安装。

Ubuntu:
```
sudo apt install nginx  //安装之后默认配置文件路径是/etc/nginx/nginx.conf
```

想要自主定制nginx编译的模块，就需要源码安装了，本文略。

## 配置静态web server

Nginx的工作方式是由配置文件nginx.conf来决定的，ubuntu下包管理方式安装nginx后，nginx.conf的默认路径是/etc/nginx/nginx.conf。

### Nginx常用命令
```
nginx -s signal
Where signal may be one of the following:
stop — fast shutdown
quit — graceful shutdown
reload — reloading the configuration file
reopen — reopening the log files
```

### Nginx配置文件语法
nginx配置文件由指令组成，指令分为简单指令和块指令。简单指令由名字和参数组成，名字和参数中间由空格隔开，以分号结尾。块指令是由{}包起来的简单指令。一对大括号构成了一个context。

在任何context外的context称为main；events和http在main下面；server在http下面；location在server下面。

![context-hierarchy](/assets/image/2020/07/nginx-context-hierarchy.jpg)

### 配置静态网站
每一个server对应一个主机设置，我们看下server这一部分的配置。

在ubuntu 16.04中，安装完nginx后，会有一个默认的静态网站配置/etc/nginx/sites-enabled/default，内容如下：
```
# Default server configuration
server {
	listen 80 default_server;
	listen [::]:80 default_server;

	root /var/www/html;

	# Add index.php to the list if you are using PHP
	index index.html index.htm index.nginx-debian.html;

	server_name _;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}
}
```

默认的网站根路径在/var/www/html，在我将其改为/root/work/之后遇到权限问题，Log中看到nginx无法访问/root/work下面的文件。这是因为nginx是以www-data用户运行的，这个用户无法访问/root目录。解决办法：不要将网站放在/root路径下，还是使用/var/www路径 ):

修改完配置文件后，直接用重加载命令使配置生效：
```
nginx -s reload
```

我的网站直接采用默认的配置，将静态文件放到/var/www路径下，至此静态网站配置完成。

### Nginx打开debug log
修改nginx.conf http context下的error_log指令：

修改前 error_log /var/log/nginx/error.log;

修改后 error_log /var/log/nginx/error.log debug;

加上debug参数，这样就打开了Nginx的debug log

## 配置https

### 申请ssl证书
配置https首先需要证书。这里购买阿里云的免费证书。参考阿里云的文档：
[https://help.aliyun.com/document_detail/156645.html?spm=a2c4g.11186623.6.608.4e011c03E38Pei](https://help.aliyun.com/document_detail/156645.html?spm=a2c4g.11186623.6.608.4e011c03E38Pei)

先购买免费DV证书，然后完成证书的申请、验证、提交审核。证书审核通过并签发后，得到证书的下载地址。阿里云会根据服务器类型提供下载地址，我们下载Nginx服务器的。

### 安装证书
接下来在Nginx服务器上安装证书，参考阿里云文档：
[https://help.aliyun.com/document_detail/98728.html?spm=5176.2020520163.cas.10.72c856a7M1c9xK](https://help.aliyun.com/document_detail/98728.html?spm=5176.2020520163.cas.10.72c856a7M1c9xK)

下载的证书文件解压后有两个文件：.pem后缀的为证书文件；.key后缀的为密钥文件。

在上文的配置静态网站一节有提到修改/etc/nginx/sites-enabled/default来配置静态网站，这里继续修改此文件，增加SSL的配置。

修改后内容如下：
 ```
 server {
	listen 80 default_server;
	listen [::]:80 default_server;

	# SSL configuration
	#
	listen 443 ssl default_server;
	listen [::]:443 ssl default_server;
	ssl_certificate /usr/share/nginx/cert/www.jiansoft.net.pem;
	ssl_certificate_key /usr/share/nginx/cert/www.jiansoft.net.key;
	keepalive_timeout 5m;
	add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
	ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
	ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
	ssl_prefer_server_ciphers on;

	root /var/www/site/_site;

	# Add index.php to the list if you are using PHP
	index index.html index.htm index.nginx-debian.html;

	server_name _;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}
}
 ```

修改完之后，通过命令nginx –s reload命令使配置生效。之后就可以通过https://www.jiansoft.net访问网站了。（前提是域名的DNS已能解析到到正确的server地址）

### 设置自动跳转
想让http自动跳转到https怎么设置？依然是修改/etc/nginx/sites-enabled/default。

首先注释掉server里的80端口的监听，加#号表示注释：
```
server {
	#listen 80 default_server;
	#listen [::]:80 default_server;
```

然后再单独建一个监听80端口的server，做重定向的操作：
```
server {
        listen 80;
        listen [::]:80;
        server_name jiansoft.net www.jiansoft.net;
        return 301 https://$server_name$request_uri;
}
```

最终的/etc/nginx/sites-enabled/default文件内容如下：
```
server {
	#listen 80 default_server;
	#listen [::]:80 default_server;

	# SSL configuration
	#
	listen 443 ssl default_server;
	listen [::]:443 ssl default_server;
	ssl_certificate /usr/share/nginx/cert/www.jiansoft.net.pem;
	ssl_certificate_key /usr/share/nginx/cert/www.jiansoft.net.key;
	keepalive_timeout 5m;
	add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
	ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
	ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
	ssl_prefer_server_ciphers on;

	root /var/www/site/_site;

	# Add index.php to the list if you are using PHP
	index index.html index.htm index.nginx-debian.html;

	server_name _;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}
}

server {
	listen 80;
	listen [::]:80;
	server_name jiansoft.net www.jiansoft.net;
	return 301 https://$server_name$request_uri;
}
```

修改完之后，通过命令nginx –s reload命令使配置生效。之后访问http://www.jiansoft.net时，浏览器会重定向到https://www.jiansoft.net。
