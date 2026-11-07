import re,sys
pat=re.compile(r'("(?:[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)"\s*:\s*")[^"]*(")')
for l in sys.stdin:
    l=pat.sub(r'\1REDACTED\2',l)
    l=re.sub(r'(postgres(?:ql)?://[^:/\s]+:)[^@\s]+@',r'\1***@',l)
    sys.stdout.write(l)
