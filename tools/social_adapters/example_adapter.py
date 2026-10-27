"""Example custom adapter for `xp social`. Copy this file to tools/social_adapters/<name>.py, then:

    xp social target add mytarget --adapter <name> --platform tiktok

`post()` is called by `xp social run` when a queued job is due. Raise an exception on failure (the job is marked `loi`
and can be retried with `xp social retry <id>`). Read credentials from environment variables or `keys.load(job['root'])`,
never hard-code them in this file.
"""


def post(job, target, log):
    """job: {id, video, file, title, caption, platform, luc (ISO time), giay (seconds), dich (alias), root}
    target: the dict saved by `xp social target add` (adapter, platform, plus any keys you add by hand).
    Return {'state': 'completed', 'link': '<public URL or id>'}."""
    log(f"[example] would upload {job['file']} with title {job['title']!r}")
    raise NotImplementedError('example adapter — implement your platform upload here')
