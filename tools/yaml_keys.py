"""mega-shot · English YAML keys.

The engine was written with Vietnamese key names (`canh`, `loi`, `phu_de`, …). Every key also has an English name; both work
and can be mixed. English keys are translated to the internal names right after a file is read, so templates, film.html
(`c.data.<key>`) and older videos keep working unchanged. If a block has BOTH names for the same key, the Vietnamese
(internal) one wins and a warning is printed.

Full table: docs/yaml-reference.md (generated from the maps below: `python tools/yaml_keys.py --markdown`).
"""

TOP = {
    'name': 'ten', 'format': 'khung', 'language': 'ngon_ngu', 'loudness': 'do_to', 'voice': 'giong', 'music': 'nhac',
    'scenes': 'canh', 'style': 'phong_cach', 'pacing': 'nhip', 'extra_sources': 'nguon_them', 'target_seconds': 'muc_tieu_giay',
    'final_episode': 'tap_cuoi', 'publish': 'dang_bai', 'characters': 'nhan_vat', 'news': 'tin', 'story': 'truyen', 'grade': 'mau',
    'hashtags': 'hashtag', 'references': 'tham_khao',
}
VOICE = {'sample': 'mau', 'volume': 'am_luong', 'speed': 'toc_do', 'retry_below': 'thu_lai_duoi', 'attempts': 'so_lan_thu',
         'numbers': 'doc_so', 'pronounce': 'doc', 'pitch': 'cao_do'}
MUSIC = {'volume': 'am_luong', 'duck': 'tu_ha', 'from': 'tu', 'to': 'den', 'score': 'soan', 'keep': 'giu'}
STYLE = {'kind': 'kieu', 'overlays': 'lop_phu', 'ocean_hud': 'hud_bien', 'danger_words': 'tu_do', 'label': 'nhan', 'chapter_label': 'nhan_chuong',
         'subtitle_y': 'phu_de_y'}
NEWS = {'channel': 'kenh', 'date': 'ngay', 'ticker_label': 'ticker_nhan'}
QUOTE = {'text': 'chu', 'source': 'nguon', 'at': 'luc'}
SFX = {'level': 'muc', 'ambience': 'am_nen', 'ambience_level': 'nen_muc', 'auto': 'tu_dong', 'replace': 'thay'}
PACING = {'gap': 'dem', 'pause': 'nghi', 'tail': 'duoi'}
GRADE = {'look': 'kieu', 'amount': 'muc', 'balance': 'can'}
PUBLISH = {'titles': 'tieu_de', 'hook': 'moc', 'topics': 'noi_dung', 'drama': 'kich_tinh', 'trust': 'cam_ket', 'tags': 'tag'}
SCENE = {
    'narration': 'loi', 'text': 'loi', 'subtitle': 'phu_de', 'title': 'chu', 'title_box': 'chu_nen', 'title_hold': 'chu_giu',
    'labels': 'nhan', 'graphic': 'do_hoa', 'year': 'nam', 'search': 'tim', 'transition': 'chuyen', 'transition_length': 'chuyen_dai',
    'reveal': 'tiet_lo', 'fade_to_dark': 'toi_dan', 'darkness': 'toi_dan_den', 'filter': 'loc', 'gap': 'dem', 'pause': 'nghi',
    'extra': 'them', 'image': 'anh', 'depth': 'do_sau', 'sounds': 'am', 'overlays': 'lop_phu', 'drift': 'troi', 'focus': 'tam',
    'speaker': 'ai', 'dialogue': 'doi_dap', 'heading': 'tieu_de', 'duration': 'thoi_luong', 'kind': 'kieu', 'chapter': 'chuong',
    'quote': 'trich', 'punchline': 'chot', 'body_clock': 'dong_ho', 'set3d': 'canh3d', 'question': 'hoi', 'source_note': 'nguon',
}
SEARCH = {'query': 'q', 'type': 'loai', 'source': 'nguon', 'pick': 'chon', 'start': 'tu', 'center_x': 'tam_x', 'file': 'tep',
          'crop': 'cat', 'author': 'tac_gia', 'license': 'giay_phep', 'parallax': '25d', 'caption': 'chu_thich', 'page': 'trang'}
SEARCH_VALUES = {'loai': {'image': 'anh', 'photo': 'anh'}}
LABEL = {'text': 'chu', 'point': 'diem', 'at': 'luc', 'warning': 'canh_bao'}
GRAPHIC = {'kind': 'kieu', 'items': 'muc', 'label': 'ten', 'value': 'gt', 'unit': 'don_vi', 'ratio': 'ty_le', 'position': 'vi_tri'}
IMAGE = {'description': 'mo_ta'}
SOUND = {'name': 'ten', 'at_word': 'tu', 'at': 'luc', 'level': 'muc'}
SERIES = {
    'name': 'ten', 'format': 'khung', 'language': 'ngon_ngu', 'voice': 'giong', 'music': 'nhac', 'style': 'phong_cach', 'loudness': 'do_to',
    'pacing': 'nhip', 'extra_sources': 'nguon_them', 'target_seconds': 'muc_tieu_giay',
    'title': 'tieu_de', 'tagline': 'mo_ta', 'intro': 'gioi_thieu', 'references': 'tham_khao', 'hashtags': 'hashtag',
    'credit_overrides': 'ghi_cong_sua', 'opening': 'mo_dau', 'chapter_card': 'the_chuong', 'end_card': 'ket', 'episodes': 'tap',
}
EPISODE = {'folder': 'thu_muc', 'title': 'tieu_de'}
OPENING = {'length': 'dai', 'folder': 'thu_muc'}
TEMPLATES = {'blank': 'trong', 'canvas': 'trong', 'ai-image': 'anh-ai', 'manifesto': 'tuyen-ngon', 'medical': 'y-khoa', 'news': 'tin-tuc',
             'story': 'truyen', 'philosophy': 'triet-ly'}


def _map(d, table, where, warn):
    if not isinstance(d, dict): return d
    for en, vi in table.items():
        if en in d and en != vi:
            if vi in d: warn(f'{where}: both "{en}" and "{vi}" are set — using "{vi}"'); d.pop(en)
            else: d[vi] = d.pop(en)
    return d


def _sub(d, key, table, where, warn):
    v = d.get(key) if isinstance(d, dict) else None
    if isinstance(v, dict): _map(v, table, f'{where}.{key}', warn)
    elif isinstance(v, list):
        for i, x in enumerate(v): _map(x, table, f'{where}.{key}[{i}]', warn)
    return v


def _scene(c, where, warn):
    _map(c, SCENE, where, warn)
    for x in (_sub(c, 'tim', SEARCH, where, warn) or []) if isinstance(c.get('tim'), list) else [c.get('tim')] if isinstance(c.get('tim'), dict) else []:
        if isinstance(x, dict):
            for k, vals in SEARCH_VALUES.items():
                if isinstance(x.get(k), str) and x[k] in vals: x[k] = vals[x[k]]
    _sub(c, 'nhan', LABEL, where, warn); _sub(c, 'do_hoa', GRAPHIC, where, warn); _sub(c, 'anh', IMAGE, where, warn)
    _sub(c, 'am', SOUND, where, warn); _sub(c, 'giong', VOICE, where, warn); _sub(c, 'mau', GRADE, where, warn); _sub(c, 'trich', QUOTE, where, warn)
    if isinstance(c.get('doi_dap'), list):
        for x in c['doi_dap']: _map(x, {'speaker': 'ai', 'narration': 'loi', 'text': 'loi', 'subtitle': 'phu_de'}, where + '.dialogue', warn)


def _common(s, where, warn):
    _sub(s, 'giong', VOICE, where, warn); _sub(s, 'nhac', MUSIC, where, warn); _sub(s, 'phong_cach', STYLE, where, warn)
    _sub(s, 'sfx', SFX, where, warn); _sub(s, 'nhip', PACING, where, warn); _sub(s, 'mau', GRADE, where, warn)
    if isinstance(s.get('nhan_vat'), dict):
        for k, v in s['nhan_vat'].items():
            if isinstance(v, dict): _sub(v, 'giong', VOICE, f'{where}.characters.{k}', warn)


def normalize(s, warn=lambda m: None):
    """video.yaml → internal key names (in place; also returns it)."""
    if not isinstance(s, dict): return s
    _map(s, TOP, 'video.yaml', warn); _common(s, 'video.yaml', warn); _sub(s, 'dang_bai', PUBLISH, 'video.yaml', warn); _sub(s, 'tin', NEWS, 'video.yaml', warn)
    for i, c in enumerate(s.get('canh') or []):
        if isinstance(c, dict): _scene(c, f"scene {c.get('id', i)}", warn)
    return s


def normalize_series(L, warn=lambda m: None):
    """loat.yaml (series) → internal key names."""
    if not isinstance(L, dict): return L
    _map(L, SERIES, 'loat.yaml', warn); _common(L, 'loat.yaml', warn)
    _sub(L, 'tap', EPISODE, 'loat.yaml', warn); _sub(L, 'mo_dau', OPENING, 'loat.yaml', warn)
    return L


def markdown():
    rows = ['| Block | English key | Internal (Vietnamese) key |', '|---|---|---|']
    for block, t in (('top level (video.yaml)', TOP), ('voice / giong', VOICE), ('music / nhac', MUSIC), ('style / phong_cach', STYLE),
                     ('sfx', SFX), ('pacing / nhip', PACING), ('grade / mau', GRADE), ('publish / dang_bai', PUBLISH),
                     ('scene (scenes[] / canh[])', SCENE), ('search item (search[] / tim[])', SEARCH), ('label (labels[] / nhan[])', LABEL),
                     ('graphic / do_hoa', GRAPHIC), ('quote / trich', QUOTE), ('news / tin', NEWS), ('image / anh', IMAGE), ('sound (sounds[] / am[])', SOUND),
                     ('series (loat.yaml)', SERIES), ('episode (episodes[] / tap[])', EPISODE), ('opening / mo_dau', OPENING),
                     ('`xp new --template`', TEMPLATES)):
        rows += [f'| {block} | `{en}` | `{vi}` |' for en, vi in t.items()]
    return '\n'.join(rows)


if __name__ == '__main__':
    import sys
    if '--markdown' in sys.argv: print(markdown())
