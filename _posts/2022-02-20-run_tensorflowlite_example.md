---
title: TensorFlow Lite图像分类实战
---

TFL(TensorFlow Lite)是TensorFlow面向移动设备、嵌入式设备的执行机器学习的工具。
在嵌入式设备上调试TFL之前，我们先在x86环境将其跑起来。
本文记录作者在x86-64 Linux环境中如何运行TFL的图像分类示例。

运行环境：
- CPU: 11th Gen Intel(R) Core(TM) i5-1135G7
- Window 10
- VMware Workstation 16 + Ubuntu 20.04
- Python3 3.8.10(Ubuntu 20.04自带)

## 第1步：安装TensorFlow Lite解释器

```
python3 -m pip install tflite-runtime
```

安装之前，先将pip的源改为国内。

1. 创建~/.pip/pip.conf
2. 在其中添加或修改：

```
[global]
index-url = https://mirrors.aliyun.com/pypi/simple/

[install]
trusted-host=mirrors.aliyun.com
```

## 第2步：下载TensorFlow Lite的图像分类示例代码

```
git clone https://github.com/tensorflow/examples --depth 1
cd examples/lite/examples/image_classification/raspberry_pi
```

参照此路径下的README，运行sh setup.sh。

setup.sh中有一步是下载模型文件efficientnet_lite0.tflite，如果下载失败，
可以手动浏览器打开链接https://tfhub.dev/tensorflow/lite-model/efficientnet/lite0/uint8/2?lite-format=tflite下载。
手动下载下来的文件名为lite-model_efficientnet_lite0_uint8_2.tflite，需要将其重命名为efficientnet_lite0.tflite(image_classifier_test.py使用此文件)。

之后运行demo中自带的测试用例`python3 image_classifier_test.py`，可以看到运行正常，输出结果如下：
```
.....
----------------------------------------------------------------------
Ran 5 tests in 4.385s

OK
```

### 第3步：写一个自己的测试代码

参照image_classifier_test.py，自己写一个简单的测试代码。
测试代码的功能是对test_data/fox.jpeg文件执行图像分类运算，并输出结果。

my_test.py内容如下：
```
import sys
import time

import cv2
from image_classifier import Category
from image_classifier import ImageClassifier
from image_classifier import ImageClassifierOptions

_IMAGE_FILE = 'test_data/fox.jpeg'  #测试文件
_MODEL_FILE = 'efficientnet_lite0.tflite'  #模型文件

image = cv2.imread(_IMAGE_FILE)
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
classifier = ImageClassifier(_MODEL_FILE)  #加载模型

stime = time.time()
categories = classifier.classify(image)  #运行图像分类模型
endtime = time.time()
print(endtime - stime)  #打印模型执行时间
 
print(categories)  #打印图像分类结果
```

执行：`python3 my_test.py`

执行结果如下：
```
0.03605842590332031
[Category(label='red fox', score=0.77734375), Category(label='kit fox', score=0.10546875), Category(label='grey fox', score=0.046875)]
```

即在我的PC上，对test/fox.jpeg文件运行一次efficientnet_lite0.tflite模型，耗时36ms。
识别test/fox.jpeg图片是"red fox"的概率为77.7%。


---
参考链接：

https://tensorflow.google.cn/lite/guide/python （注意语言选择英语，汉语的内容更新较慢）

