---
title: Wi-Fi HIDL接口梳理
---
## Android Wi-Fi架构概述

熟悉Android Wi-Fi Framework的同学都知道，Android Wi-Fi架构如下图所示：

![wifi-arch](/assets/image/2020/05/15/wifi-arch.png)


简单来说Android Wi-Fi架构分三层：
1. Application层，即应用层，指系统应用或第三方应用
2. Wi-Fi Service层，属于Android framework层，是aosp中Wi-Fi相关功能的主要代码
3. Native层，包括wpa_supplicant、hostapd、driver

这篇文章聚焦在Wi-Fi Service层和Native层之间的HIDL接口，梳理下都有哪些HIDL接口以及这些接口的功能。为后续分析WiFi具体功能流程时打下基础。

从上面的架构图可以看到，HIDL接口主要分三类，Vendor HAL、Supplicant HAL和Hostapd HAL：

- Vendor HAL: Android专用命令的HAL接口。HIDL 文件位于 hardware/interfaces/wifi/1.x 中
- Supplicant HAL: wpa_supplicant的HAL接口。HIDL 文件位于 hardware/interfaces/supplicant/1.x 中
- Hostapd HAL: hostapd的HAL接口。HIDL 文件位于 hardware/interfaces/hostapd/1.x 中

## HIDL接口简介
分析具体Wi-Fi Service的HIDL接口之前，先简单了解下Android HIDL机制。

HIDL是HAL interface definition language的缩写，用来定义HAL和HAL使用者之间的接口。HIDL可以让通信的两端代码独立编译。HIDL旨在用于进程间通信，进程间通信采用Binder机制。
HIDL在一个接口文件中指定数据结构和方法签名，最终生成一个包。HIDL语法与C类似。

### HIDL设计初衷
HIDL设计的目标是可以独立的替换android framework而不用重新编译HAL层。HAL层由vendor厂商编译，放到/vendor分区；framework在其它分区，OTA可以直接替换framework所在的分区，而不用重新编译HAL。

HIDL设计考虑以下方面的平衡：
- 互操作性：在可以使用各种架构、工具链和构建配置来编译的进程之间创建可互操作的可靠接口。HIDL 接口带有版本编号，发布后无法再进行更改。
- 效率： HIDL 会尝试尽可能减少复制操作的次数。HIDL 定义的数据以 C++ 标准布局数据结构传递至 C++ 代码，无需解包，可直接使用。此外，HIDL 还提供共享内存接口；由于 RPC 本身有点慢，因此 HIDL 支持两种无需使用 RPC 调用的数据传输方法：共享内存和快速消息队列 (FMQ)。
- 直观： 通过仅针对 RPC 使用 in 参数，HIDL 避开了内存所有权这一棘手问题。无论是将数据传递到 HIDL 中以进行传输，还是从 HIDL 接收数据，都不会改变数据的所有权。

### HIDL语法关键字
- generates: 表示将值返回客户端的接口方法。要返回一个非原始值或多个值，会生成同步回调函数。
- oneway: 用来修饰HIDL方法，表示这个方法没有返回值并且非阻塞。

## Wi-Fi HIDL接口梳理
下面开始梳理WiFi HIDL接口，主要梳理Vendor HAL和Supplicant HAL两部分，Hostapd HAL留到后面分析Soft AP代码时再补充。这里以列表的方式列出接口名和接口描述，为后续分析WiFi代码流程打基础。

### Vendor HAL
#### IWifi.hal
HAL模块的根模块，加载WiFi HAL时返回的接口

- 1.0

接口名 | 描述
------ | -------
registerEventCallback |
isStarted | 获取HAL当前状态
start | 执行使用这个模块的任何设置动作
stop |
getChipIds |
getChip | 获取chip的HIDL接口对象
 
#### IWifiEventCallback.hal

接口名 | 描述
------ | -------
oneway onStart() |
oneway onStop() |
oneway onFailure |

#### IWifiChip.hal
表示芯片的接口

- 1.0

接口名 | 描述
------ | -------
getId | 
registerEventCallback | 注册这个chip上事件的回调
getCapabilities | 
getAvailableModes | 
configureChip | 
getMode | 
createApIface | 
getApIfaceNames | 
getApIface | 
removeApIface | 
createNanIface | 
createP2pIface | 
createStaIface | 
createRttController |

- 1.1

接口名 | 描述
------ | -------
selectTxPowerScenario | 选择tx功率场景，OEM厂商可以定义不同场景的功率配置
resetTxPowerScenario | 

- 1.2

接口名 | 描述
------ | -------
selectTxPowerScenario_1_2 | 选择tx功率场景，OEM厂商可以定义不同场景的功率配置
registerEventCallback_1_2 | 

- 1.3

接口名 | 描述
------ | -------
getCapabilities_1_3 | 1.3新增SET_LATENCY_MODE和P2P_RAND_MAC两个能力
setLatencyMode | 设置低时延模式；低时延优化是牺牲扫描、漫游等功能的权衡
flushRingBufferToFile | This API help to collect firmware/driver/pkt logs

#### IWifiChipEventCallback.hal
- 1.0

接口名 | 描述
------ | -------
oneway onChipReconfigured | 表示芯片重配置成功
oneway onChipReconfigureFailure |
oneway onIfaceAdded | 
oneway onIfaceRemoved | 
oneway onDebugRingBufferDataAvailable | 
oneway onDebugErrorAlert | 

- 1.2

接口名 | 描述
------ | -------
oneway onRadioModeChange |


#### IWifiIface.hal
用来表示单个接口的接口

接口名 | 描述
------ | -------
getType |
getName |

#### IWifiStaIface.hal
用来表示单个STA接口的接口

- 1.0

接口名 | 描述
------ | -------
registerEventCallback |
getCapabilities | 获取这个STA Iface支持的能力
getApfPacketFilterCapabilities | 查询芯片支持的APF能力
installApfPacketFilter | 安装APF程序
getBackgroundScanCapabilities |
getValidFrequenciesForBand |
startBackgroundScan |
stopBackgroundScan |
enableLinkLayerStatsCollection |
disableLinkLayerStatsCollection |
getLinkLayerStats |
startRssiMonitoring |
stopRssiMonitoring |
getRoamingCapabilities |
configureRoaming |
setRoamingState |
enableNdOffload |
startSendingKeepAlivePackets |
stopSendingKeepAlivePackets |
setScanningMacOui |
startDebugPacketFateMonitoring |
getDebugTxPacketFates |
getDebugRxPacketFates |

- 1.2

接口名 | 描述
------ | -------
readApfPacketFilterData | 获取APF程序，获取APF程序等同于被卸载
setMacAddress |

- 1.3

接口名 | 描述
------ | -------
getLinkLayerStats_1_3 | 
getFactoryMacAddress | 获取这个STA接口的工厂MAC

#### IWifiStaIfaceEventCallback

接口名 | 描述
------ | -------
oneway onBackgroundScanFailure |
oneway onBackgroundFullScanResult |
oneway onBackgroundScanResults |
oneway onRssiThresholdBreached |

#### IWifiApIface.hal

接口名 | 描述
------ | -------
setCountryCode |
getValidFrequenciesForBand |


### Supplicant HAL
#### ISupplicant.hal

- 1.0

接口名 | 描述
------ | -------
getInterface | 获取supplicant控制的一个HIDL接口对象
listInterfaces | 获取supplicant控制的所有接口
registerCallback | 注册supplicant服务的回调,这些回调由不属于任何接口或网络的全局事件回调
setConcurrencyPriority | P2P和STA单信道共存产生信道冲突时，设置谁更优先

- 1.1

接口名 | 描述
------ | -------
addInterface | 注册一个接口到supplicant
removeInterface | 从supplicant去注册一个接口
oneway terminate | 

#### ISupplicantCallback.hal
supplicant服务提供的callback接口，通过ISupplicant.registerCallback注册

- 1.0

接口名 | 描述
------ | -------
oneway onInterfaceCreated | 一个新的接口被创建
oneway onInterfaceRemoved | 一个接口被删除
oneway onTerminating | supplicant退出

#### ISupplicantIface.hal
supplicant对每个网络接口(比如wlan0)暴露的接口

- 1.0

接口名 | 描述
------ | -------
getName | 获取网络接口名字，比如返回wlan0
getType | 获取网络接口类型，比如STA
addNetwork | 添加一个网络，返回这个网络的HIDL接口对象
removeNetwork | 移除网络
getNetwork | 获取网络
listNetworks | 获取网络列表
WPS相关的一些接口 |
setWpsDeviceName | 
setWpsDeviceType | 
setWpsManufacturer | 
setWpsModelName | 
setWpsModelNumber | 
setWpsSerialNumber | 
setWpsConfigMethods | 


#### ISupplicantNetwork.hal
supplicant为每个网络配置暴露的接口

- 1.0

接口名 | 描述
------ | -------
getId | 获取由supplicant所分配的网络的ID
getInterfaceName | 获取这个网络所属的interface name
getType | 获取这个网络所属的interface type

#### ISupplicantStaIface.hal
extends ISupplicantIface，supplicant为每个station模式网络接口暴露的接口
- 1.0

接口名 | 描述
------ | -------
registerCallback | 注册这个接口的回调
reassociate | 重连当前使能的网络，即使是已连接
reconnect | 重连当前使能的网络，在当前是断连状态下
disconnect | 断开当前使能的网络
setPowerSave | 开关power save
initiateTdlsDiscover | 发起TDLS discover
initiateTdlsSetup | 发起TDLS设置
initiateTdlsTeardown | 发起TDLS down
initiateAnqpQuery | 发起ANQP查询
initiateHs20IconQuery | 发起Hotspot2.0图标查询
getMacAddress | 获取MAC地址
startRxFilter | 开启rx filter
stopRxFilter | 停止rx filter
addRxFilter | 添加指定的rx filter
removeRxFilter | 删除指定的rx filter
setBtCoexistenceMode | 
setBtCoexistenceScanModeEnabled | 
setSuspendModeEnabled | 
setCountryCode | 
startWpsRegistrar | 
startWpsPbc | 
startWpsPinKeypad |
cancelWps | 
setExternalSim | 
addExtRadioWork | 
removeExtRadioWork | 
enableAutoReconnect | 

- 1.1

接口名 | 描述
------ | -------
registerCallback_1_1 |

- 1.2

增加了DPP相关的接口

接口名 | 描述
------ | -------
registerCallback_1_2 |
getKeyMgmtCapabilities |
addDppPeerUri |
removeDppUri |
startDppConfiguratorInitiator |
startDppEnrolleeInitiator |
stopDppInitiator |


#### ISupplicantStaIfaceCallback.hal
supplicant为STA模式接口暴露的回调接口
- 1.0

接口名 | 描述
------ | -------
oneway onNetworkAdded | 
oneway onNetworkRemoved | 
oneway onStateChanged | 
oneway onAnqpQueryDone | 
oneway onHs20IconQueryDone | 
oneway onHs20SubscriptionRemediation | 
onHs20DeauthImminentNotice | 
oneway onDisconnected | 
oneway onAssociationRejected | 
oneway onAuthenticationTimeout | 
oneway onEapFailure | 
oneway onBssidChanged | 
oneway onWpsEventSuccess | 
oneway onWpsEventFail | 
oneway onWpsEventPbcOverlap | 
oneway onExtRadioWorkStart | 
oneway onExtRadioWorkTimeout | 

- 1.1

接口名 | 描述
------ | -------
oneway onEapFailure_1_1 | 指示EAP认证失败

- 1.2

接口名 | 描述
------ | -------
oneway onDppSuccessConfigReceived | 
oneway onDppSuccessConfigSent |
oneway onDppProgress |
oneway onDppFailure |


#### ISupplicantStaNetwork.hal
extends ISupplicantNetwork，supplicant为每个STA模式网络配置暴露的接口

- 1.0

接口名 | 描述
------ | -------
registerCallback | 
setSsid | 对应wpa_s中的ssid成员
setBssid | 
setScanSsid | 对于此网络是否要发probe request
setKeyMgmt | 哪一种密钥管理方式
setProto | 设置所使用的协议，即WPA WPA2
setAuthAlg | 认证算法，open/share key/LEAP
setGroupCipher | 
setPairwiseCipher | 
setPskPassphrase | 
setPsk | 直接设置raw psk
setWepKey | 
setWepTxKeyIdx | 
setRequirePmf | 
setEapMethod | 
setEapPhase2Method | 
setEapIdentity | 
setEapAnonymousIdentity | 
setEapPassword | 
setEapCACert | 设置EAP CA证书文件路径
setEapCAPath | 设置CA证书文件夹路径
setEapClientCert | 
setEapPrivateKeyId | 
setEapSubjectMatch | 
setEapAltSubjectMatch | 
setEapEngine | Enable EAP Open SSL Engine for this network
setEapEngineID | 
setEapDomainSuffixMatch | 
setProactiveKeyCaching | 
setIdStr | 
enable | 
disable | 
select | 发起连接
sendNetworkEapSimGsmAuthResponse |
sendNetworkEapSimGsmAuthFailure |
sendNetworkEapSimUmtsAuthResponse |
sendNetworkEapSimUmtsAutsResponse |
sendNetworkEapSimUmtsAuthFailure |
sendNetworkEapIdentityResponse |

- 1.1

接口名 | 描述
------ | -------
setEapEncryptedImsiIdentity |
sendNetworkEapIdentityResponse_1_1 |

- 1.2 

接口名 | 描述
------ | -------
setKeyMgmt_1_2 |
getKeyMgmt_1_2 |
setPairwiseCipher_1_2 |
getPairwiseCipher_1_2 |
setGroupCipher_1_2 |
getGroupCipher_1_2 |
setGroupMgmtCipher |
getGroupMgmtCipher |
enableTlsSuiteBEapPhase1Param |
enableSuiteBEapOpenSslCiphers |
getSaePassword |
getSaePasswordId |
getSaePasswordId |
setSaePasswordId |

#### ISupplicantStaNetworkCallback
supplicant为每一个网路配置暴露的回调接口

- 1.0

接口名 | 描述
------ | -------
oneway onNetworkEapSimGsmAuthRequest |
oneway onNetworkEapSimUmtsAuthRequest |
oneway onNetworkEapIdentityRequest |

