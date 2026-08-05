#!/usr/bin/env python3

import json
import os
import re
import subprocess
import sys
import urllib.request

FONT_DIR = 'static/fonts'
FONTS_TO_SUBSET = [
    ('Noto-Sans-SC-regular.woff2', 'Noto-Sans-SC-subset.woff2'),
    ('Noto-Sans-SC-700.woff2', 'Noto-Sans-SC-700-subset.woff2'),
    ('Noto-Serif-SC-500.woff2', 'Noto-Serif-SC-500-subset.woff2'),
    ('Noto-Serif-SC-700.woff2', 'Noto-Serif-SC-700-subset.woff2'),
    ('Noto-Sans-JP-regular.woff2', 'Noto-Sans-JP-subset.woff2'),
    ('Noto-Sans-JP-700.woff2', 'Noto-Sans-JP-700-subset.woff2'),
]

def fetch_twikoo_chars(env_id):
    # 从 Twikoo 评论区提取 CJK 字符
    chars = set()
    seen = set()
    CJK_RE = re.compile(r'[一-鿿぀-ゟ゠-ヿ　-〿]')
    page = 1
    while True:
        try:
            body = json.dumps({'event': 'GET_RECENT_COMMENTS', 'pageSize': 100, 'page': page}).encode()
            req = urllib.request.Request(env_id, data=body,
                headers={'Content-Type': 'application/json', 'User-Agent': 'subset-fonts/1.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
            items = data.get('data') or []
            new_count = 0
            for item in items:
                cid = item.get('id')
                if cid and cid in seen:
                    continue
                if cid:
                    seen.add(cid)
                new_count += 1
                text = (item.get('commentText') or '') + ' ' + (item.get('nick') or '')
                chars.update(CJK_RE.findall(text))
            print(f'  第 {page} 页: {new_count} 条新评论（共 {len(items)} 条返回）')
            if new_count == 0 or len(items) == 0:
                break
            page += 1
        except Exception as e:
            print(f'  ✗ 获取评论失败（第 {page} 页）: {e}')
            break
    return chars

def main():
    # 提取中日文字符
    # 一-鿿  CJK Unified Ideographs
    # ぀-ゟ  Hiragana
    # ゠-ヿ  Katakana
    # 　-〿  CJK Symbols and Punctuation
    CJK_RE = re.compile(r'[一-鿿぀-ゟ゠-ヿ　-〿]')

    chars = set()
    for root, _, files in os.walk('content'):
        for f in files:
            if f.endswith('.md'):
                chars.update(CJK_RE.findall(open(os.path.join(root, f), encoding='utf-8').read()))
    for root, _, files in os.walk('layouts'):
        for f in files:
            if f.endswith('.html'):
                chars.update(CJK_RE.findall(open(os.path.join(root, f), encoding='utf-8').read()))

    # 评论区字符
    twikoo_chars = fetch_twikoo_chars('https://comment.aspr-works.top')
    print(f'从评论区提取到 {len(twikoo_chars)} 个新字符')
    chars.update(twikoo_chars)

    # 额外补充 ASCII 常用字符 + 日文常用标点
    extra = set(
        '0123456789'
        'abcdefghijklmnopqrstuvwxyz'
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        '.,;:!?\'"-()[]{}@#$%^&*+=/<>~`|_ '
        '　、。「」『』'
        '・ー〜…'
    )
    chars.update(extra)

    cjk_han_count = len([c for c in chars if '一' <= c <= '鿿'])
    kana_count = len([c for c in chars if
                      '぀' <= c <= 'ゟ' or '゠' <= c <= 'ヿ'])
    print(f'找到 {len(chars)} 个唯一字符（{cjk_han_count} 个汉字 + {kana_count} 个假名）')

    # 写入临时文件
    tmp = 'scripts/_subset_chars.txt'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(''.join(sorted(chars)))

    # 子集化
    for src_name, dst_name in FONTS_TO_SUBSET:
        src = os.path.join(FONT_DIR, src_name)
        dst = os.path.join(FONT_DIR, dst_name)
        if not os.path.exists(src):
            print(f'  跳过: {src_name} 不存在')
            continue

        result = subprocess.run([
            sys.executable, '-m', 'fontTools', 'subset', src,
            f'--text-file={tmp}',
            '--flavor=woff2',
            f'--output-file={dst}',
        ], capture_output=True, text=True)

        if result.returncode == 0:
            old_kb = os.path.getsize(src) // 1024
            new_kb = os.path.getsize(dst) // 1024
            print(f'  ✓ {src_name}: {old_kb}KB → {new_kb}KB（{new_kb/old_kb*100:.0f}%）')
        else:
            print(f'  ✗ {src_name} 失败: {result.stderr}')

    # 清理
    os.remove(tmp)
    print('完成！')

if __name__ == '__main__':
    main()
