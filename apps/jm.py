SKIP_COVER = False
CONFIG = """
log: true
client:
  # 可配置:
  #  html - 表示网页端
  #  api - 表示APP端
  # APP端不限ip兼容性好，网页端限制ip地区但效率高
  impl: api

  # domain: 禁漫域名配置，一般无需配置，jmcomic会根据上面的impl自动设置相应域名
  # 该配置项需要和上面的impl结合使用，因为禁漫网页端和APP端使用的是不同域名，
  # 所以配置是一个dict结构，key是impl的值，value是域名列表，表示这个impl走这些域名。
  # 域名列表的使用顺序是：先用第一个域名，如果第一个域名重试n次失败，则换下一个域名重试，以此类推。
  # 下面是示例：（注意下面这些域名可能会过时，不一定能用）
  #domain:
  #  html:
  #    - 18comic.vip
  #    - 18comic.org
  #  api:
  #    - www.jmapiproxyxxx.vip

  # retry_times: 请求失败重试次数，默认为5
  retry_times: 5

  # postman: 请求配置
  postman:
    meta_data:
      # proxies: 代理配置，默认是 system，表示使用系统代理。
      # 以下的写法都可以:
      # proxies: null # 不使用代理
      # proxies: clash
      # proxies: v2ray
      # proxies: 127.0.0.1:7890
      # proxies:
      #   http: 127.0.0.1:7890
      #   https: 127.0.0.1:7890
      proxies: system

      # cookies: 帐号配置，默认是 null，表示未登录状态访问JM。
      # 禁漫的大部分本子，下载是不需要登录的；少部分敏感题材需要登录才能看。
      # 如果你希望以登录状态下载本子，最简单的方式是配置一下浏览器的cookies，
      # 不用全部cookies，只要那个叫 AVS 就行。
      # 特别注意！！！(https://github.com/hect0x7/JMComic-Crawler-Python/issues/104)
      # cookies是区分域名的：
      # 假如你要访问的是 `18comic.vip`，那么你配置的cookies也要来自于 `18comic.vip`，不能配置来自于 `jm-comic.club` 的cookies。
      # 如果你发现配置了cookies还是没有效果，大概率就是你配置的cookies和代码访问的域名不一致。
      #cookies:
      #  AVS: qkwehjjasdowqeq # 这个值是乱打的，不能用
"""

import errno
import sys
import os
import re
import json
import uuid
import base64
import jmcomic as jm

def res_success(data):
    print(json.dumps({"success": True, "data": data}))
    sys.exit()

def res_error(msg):
    print(json.dumps({"success": False, "error": msg}))
    sys.exit()

try:
    id = sys.argv[1]
    match = re.match(r"^jm(\d{3,10})$", id)
    assert match
    nid = match.group(1)
except:
    res_error("Invalid jm ID")

try:
    op = jm.create_option_by_str(CONFIG)
    cl = op.new_jm_client()
except Exception as e:
    res_error(f"Failed to initialize JM client\n{e}")

try:
    album_data = cl.get_album_detail(id)
except Exception as e:
    res_error(f"Failed to get album detail\n{e}")

cover_base64 = None
cover_err = None

if not SKIP_COVER:
    # The domain is hard coded in jmcomic module and may fail
    # If cover image fails to download we return a partial response without cover
    cover_url = f'https://{jm.JmModuleConfig.DOMAIN_IMAGE_LIST[0]}/media/albums/{nid}.jpg'

    # Generate a temporary file path for the cover image
    # Data directory should be created beforehand by JS script
    base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    cover_path = os.path.join(base_path, f'{uuid.uuid4().hex}.jpg')

    try:
        cl.download_image(cover_url, cover_path, decode_image=False)
        with open(cover_path, 'rb') as f:
            cover_data = f.read()
        cover_base64 = base64.b64encode(cover_data).decode('utf-8')
    except Exception as e:
        cover_err = e
    finally:
        try:
            os.remove(cover_path)
        except OSError as e:
            if e.errno != errno.ENOENT:
                res_error(f"Failed to remove temporary cover image file\n{e}")

try:
    res_success({
        "id": album_data.id,
        "name": album_data.name,
        "authors": album_data.authors,
        "page_count": album_data.page_count,
        "pub_date": album_data.pub_date,
        "update_date": album_data.update_date,
        "likes": album_data.likes,
        "views": album_data.views,
        "comment_count": album_data.comment_count,
        "works": album_data.works,
        "actors": album_data.actors,
        "tags": album_data.tags,
        
        "cover_base64": cover_base64,
        "cover_err": str(cover_err) if cover_err else None
    })
except Exception as e:
    res_error(f"Failed to prepare response data\n{e}")

res_error("Unknown error occurred")
