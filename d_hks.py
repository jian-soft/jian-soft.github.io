#!/usr/bin/python3
#
# copy _site to gitee repo and then git push
#

import os

gitee_path = "/var/www/site/_site"
site_path = "_site/*"
print("*******************************")
print("build...")
os.system("bundle exec jekyll build")
os.system("rm _site/d_hks.py _site/serv.sh")


print("*******************************")
print("copy to gitee path "+gitee_path)
os.system("cp -rv "+site_path+" "+gitee_path)

print("*******************************")
print("git st and git cm and git push")
#os.system("cd "+gitee_path+"; git st; git add .; git cm -m 'update'; git push")
os.system("cd "+gitee_path+"; git st")
