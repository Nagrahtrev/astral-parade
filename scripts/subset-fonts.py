#!/usr/bin/env python3

import os
import re
import subprocess
import sys

FONT_DIR = 'static/fonts'
FONTS_TO_SUBSET = [
    ('Noto-Sans-SC-regular.woff2', 'Noto-Sans-SC-subset.woff2'),
    ('Noto-Sans-SC-700.woff2', 'Noto-Sans-SC-700-subset.woff2'),
    ('Noto-Serif-SC-500.woff2', 'Noto-Serif-SC-500-subset.woff2'),
    ('Noto-Serif-SC-700.woff2', 'Noto-Serif-SC-700-subset.woff2'),
]

def main():
    # 提取中文字符
    chars = set()
    for root, _, files in os.walk('content'):
        for f in files:
            if f.endswith('.md'):
                chars.update(re.findall(r'[\u4e00-\u9fff]', open(os.path.join(root, f), encoding='utf-8').read()))
    for root, _, files in os.walk('layouts'):
        for f in files:
            if f.endswith('.html'):
                chars.update(re.findall(r'[\u4e00-\u9fff]', open(os.path.join(root, f), encoding='utf-8').read()))

    # 额外补充
    extra = set('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,;:!?\'"-()[]{}@#$%^&*+=/<>~`|_ ')
    chars.update(extra)

    cjk_count = len([c for c in chars if '\u4e00' <= c <= '\u9fff'])
    print(f'找到 {len(chars)} 个唯一字符（其中 {cjk_count} 个中文）')

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
            sys.executable, '-m', 'fonttools', 'subset', src,
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
