"""Generate the news bed score (ABC) from a per-scene chord plan so every voice has identical bar lengths.
Plan: (scene id, [(meter_eighths, chord), ...], dynamics). 84 bpm, D minor, low strings + pizzicato pulse + sparse piano."""
PLAN = [
    ('mo-dau',      [(8, 'Dm'), (8, 'Bb'), (8, 'F'), (4, 'C')], 'p'),
    ('ban-do-dien', [(8, 'Dm'), (8, 'Bb'), (8, 'F'), (6, 'C')], 'mp'),
    ('drone',       [(8, 'Dm'), (8, 'Bb'), (6, 'Gm'), (4, 'A')], 'mp'),
    ('lhq',         [(8, 'Dm'), (8, 'Bb'), (8, 'F'), (8, 'C'), (8, 'Dm')], 'p'),
    ('mat-tran',    [(8, 'Bb'), (8, 'Gm'), (8, 'A'), (8, 'Dm'), (8, 'Bb')], 'mf'),
    ('hai-phia',    [(8, 'Gm'), (8, 'A'), (8, 'Dm'), (8, 'Bb'), (6, 'A')], 'mf'),
    ('ngoai-giao',  [(8, 'Dm'), (8, 'Bb'), (8, 'F'), (8, 'C'), (8, 'Dm'), (6, 'A')], 'mp'),
    ('ket',         [(8, 'Dm'), (8, 'Bb'), (8, 'Dm')], 'p'),
]
# chord → (low-string voicing, pizzicato root/fifth/octave, piano motif notes)
CH = {'Dm': ('[D,,A,,D,]', ['D,', 'A,', 'D', 'A,'], ['d', 'a']), 'Bb': ('[B,,,F,,B,,]', ['B,,', 'F,', 'B,', 'F,'], ['d', 'f']),
      'F': ('[F,,C,F,]', ['F,', 'C', 'F', 'C'], ['c', 'f']), 'C': ('[C,,G,,C,]', ['C,', 'G,', 'C', 'G,'], ['c', 'e']),
      'Gm': ('[G,,,D,,G,,]', ['G,,', 'D,', 'G,', 'D,'], ['d', 'g']), 'A': ('[A,,,E,,A,,]', ['A,,', 'E,', 'A,', 'E,'], ['^c', 'e'])}
M = {8: '4/4', 6: '3/4', 4: '2/4'}
str_, pz, pn = [], [], []
cur = None
for sid, bars, dyn in PLAN:
    for k, (e, ch) in enumerate(bars):
        meter = f'[M:{M[e]}] ' if M[e] != cur else ''; cur = M[e]
        head = (f'!mark:{sid}! !{dyn}! ' if k == 0 else '')
        low, roots, mot = CH[ch]
        str_.append(f'{meter}{"!" + dyn + "! " if k == 0 else ""}{low}{e}')
        q = e // 2; pz.append(f'{meter}{head}' + ' '.join(f'{roots[i % 4]}2' for i in range(q)))
        if k == 0 or (k == 2 and e == 8): pn.append(f'{meter}' + (f'{mot[0]}4 {mot[1]}{e - 4}' if e >= 6 else f'{mot[0]}4'))
        else: pn.append(f'{meter}z{e}')
pn[-1] = pn[-1].replace('z8', '!fermata! [DAd]8'); str_[-1] = str_[-1] + ''; pz[-1] = '!fermata! D,8'
abc = '\n'.join(['X:1', 'T:Diem tin chien su · nen tin tuc', 'M:4/4', 'L:1/8', 'Q:1/4=84', 'K:Dm',
                 'V:PZ inst=pizz gain=0.7', ' | '.join(pz) + ' |]',
                 'V:STR inst=lowstr gain=0.55', ' | '.join(str_) + ' |]',
                 'V:PNO inst=piano role=melody gain=0.45', ' | '.join(pn) + ' |]'])
open('nhac.abc', 'w', encoding='utf-8').write(abc + '\n'); print(abc[:600])
