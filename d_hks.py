#!/usr/bin/python3
#
# copy _site to gitee repo and then git push
#

import os

gitee_path = "/var/www/site/_site"
site_path = "_site/*"
print("*******************************")
print("copy to gitee path "+gitee_path)
print("*******************************")
print("copy to gitee path "+gitee_path)
os.system("cp -rv "+site_path+" "+gitee_path)
print("*******************************")
print("git st and git cm and git push")
print("*******************************")
print("copy to gitee path "+gitee_path)
#os.system("cd "+gitee_path+"; git st; git add .; git cm -m 'update'; git push")
os.system("cd "+gitee_path+"; git st")
