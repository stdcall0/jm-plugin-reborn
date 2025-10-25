# jm-plugin-reborn
## Yunzai 插件，为机器人提供 jm 神秘数字查询功能

### 部署

本插件用 Typescript 编写，请用下列代码部署：
```bash
git clone -b dist --depth=1 --single-branch https://github.com/stdcall0/jm-plugin-reborn ./plugins/jm-plugin

pnpm i
```

本插件调用了 Py 库 `jmcomic` 进行 API 调用。请在机器人运行环境下安装 Python >= 3.9，并安装 `jmcomic` 库：
```bash
python3 -m pip install jmcomic -U
```

可以在 `config/python.yaml` 中修改调用的 Python 可执行文件路径，默认为 `python3`。

### 功能

- 在群聊内发送 jm 数字，机器人返回查询结果
- 支持查询标题、作者、tag、上传日期
- 支持发送封面
- 多条消息支持转发消息发送

如果机器人查询失败，可能是 `jmcomic` 内置的 jm 网址过期，请尝试手动更新 Py `jmcomic` 库。

可以在 `config/jmcomic.yaml` 下修改查询的字段、启用的群聊和是否发送封面图片。
