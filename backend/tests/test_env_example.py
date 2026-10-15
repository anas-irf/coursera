"""Every environment variable the settings read is documented in backend/.env.example."""
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
# every way the settings read a variable: the typed helpers of settings/env.py, the
# collecting ``_need`` of prod.py and decouple's own ``config``
READ = re.compile(
    r"""(?:env_str|env_bool|env_int|env_list|_need|config|_config)\(\s*['"]([A-Z][A-Z0-9_]+)['"]""")
DOCUMENTED = re.compile(r'^#?\s*([A-Z][A-Z0-9_]+)=', re.MULTILINE)


def variables_read():
    names = set()
    for folder in ('config', 'apps'):
        for path in (BACKEND / folder).rglob('*.py'):
            names |= set(READ.findall(path.read_text(encoding='utf-8')))
    return names


def test_every_variable_the_settings_read_is_in_the_example_file():
    documented = set(DOCUMENTED.findall((BACKEND / '.env.example').read_text(encoding='utf-8')))

    missing = sorted(variables_read() - documented)

    assert not missing, f'add these to backend/.env.example: {missing}'


def test_the_example_file_does_not_document_variables_nobody_reads():
    documented = set(DOCUMENTED.findall((BACKEND / '.env.example').read_text(encoding='utf-8')))

    stale = sorted(documented - variables_read())

    assert not stale, f'these are in backend/.env.example but not read by the settings: {stale}'
