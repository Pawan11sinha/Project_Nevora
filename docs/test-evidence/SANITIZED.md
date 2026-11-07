# Sanitised Level 2 evidence

These copies replace machine-specific strings in 16 Level 2 evidence files, so the evidence can be committed. Created 7 November 2026, approved as Package 2.

**The originals are kept locally, unchanged, and excluded from commits.** Each copy sits next to its original, with `.sanitized` before the extension. Applying the three rules below to an original gives its copy exactly, byte for byte.

| Rule | Replaced | With |
|---|---|---|
| 1 | The session's temporary scratch directory | `<scratch>` |
| 2 | The local repository path, which contains the Mac's account name | `<repo>` |
| 3 | The Mac's private LAN address | `<local-lan-address>` |

Rules apply in that order. No other content changed, including the public Cloudflare address `104.18.24.232`, ports, process names, stack IDs, results and line counts.

The sanitised scripts are evidence, not runnable tools. They still import or call their originals by name, for example `./lib.mjs`, which aren't committed.

| Original (kept locally) | Original SHA-256 | Copy | Copy SHA-256 | Rule 1 / 2 / 3 replacements |
|---|---|---|---|---|
| `level2/run2-nonlocal.txt` | `9967ec1eb6b0909e5870119b1275afcd54050d0bab564b0c47be1708057ac85c` | `level2/run2-nonlocal.sanitized.txt` | `afebfadf7a7dfc6cbff91fd1a4de8e6c4d33c1fd87dd229b7d7177d0ae3bfacb` | 0 / 0 / 20 |
| `level2-corrected/scripts/fingerprint.sh` | `0cae26a336d428bd946d3ba9dafc166cc007997f8f2647d9dadff91d3a74b18e` | `level2-corrected/scripts/fingerprint.sanitized.sh` | `594d78513f907398cfa5385b3be59c76026085d298bc57cd50d326efda2a7f5b` | 0 / 1 / 0 |
| `level2-corrected/scripts/health.py` | `b399d83fb62a439f487c61937194e297838f6178863386b6d1af1b37a1c96e65` | `level2-corrected/scripts/health.sanitized.py` | `9433e963df722f838d2d450a9a137ccbad649df2a059778b456095f155e45cb9` | 0 / 1 / 0 |
| `level2-corrected/scripts/lib.mjs` | `695ed914e6416c805a5ffafa84aa0d95544c1ccfc03d2e75e681463c4160fcf2` | `level2-corrected/scripts/lib.sanitized.mjs` | `929c63c9ac7cef444953aefe84c9bbf0184fcb4b08cf97aeea5f66d87dc3a299` | 0 / 1 / 0 |
| `level2-mg1/scripts/health.py` | `b399d83fb62a439f487c61937194e297838f6178863386b6d1af1b37a1c96e65` | `level2-mg1/scripts/health.sanitized.py` | `9433e963df722f838d2d450a9a137ccbad649df2a059778b456095f155e45cb9` | 0 / 1 / 0 |
| `level2-mg1/scripts/q.py` | `2fde32ba6409065d3b6ad7cf560ae0f4a7d562fd692ce9bf87b6a2b120eaf00f` | `level2-mg1/scripts/q.sanitized.py` | `c22a33a629ccbfae28b18e96434b480b0900db62ff7597d28b2391637dba3573` | 0 / 1 / 0 |
| `level2-sql/scripts/fingerprint.sh` | `0cae26a336d428bd946d3ba9dafc166cc007997f8f2647d9dadff91d3a74b18e` | `level2-sql/scripts/fingerprint.sanitized.sh` | `594d78513f907398cfa5385b3be59c76026085d298bc57cd50d326efda2a7f5b` | 0 / 1 / 0 |
| `level2-sql/scripts/health.py` | `b399d83fb62a439f487c61937194e297838f6178863386b6d1af1b37a1c96e65` | `level2-sql/scripts/health.sanitized.py` | `9433e963df722f838d2d450a9a137ccbad649df2a059778b456095f155e45cb9` | 0 / 1 / 0 |
| `level2-sql/scripts/q.py` | `2fde32ba6409065d3b6ad7cf560ae0f4a7d562fd692ce9bf87b6a2b120eaf00f` | `level2-sql/scripts/q.sanitized.py` | `c22a33a629ccbfae28b18e96434b480b0900db62ff7597d28b2391637dba3573` | 0 / 1 / 0 |
| `level2-mg1/evidence/mg-up.txt` | `9bd76d40fac17bc9fdc95903a19b71a3b326e6b17eed6124f50a768e50a3d69d` | `level2-mg1/evidence/mg-up.sanitized.txt` | `32a18347961aeb20ca61e306a2a4ba46b5725a6c24fba0383ac4229d883cc5fe` | 1 / 0 / 0 |
| `level2-sql/evidence/dp1-data.txt` | `c8fa27f1a4cdea907d0680558577ef51528d0089e88c3ec514cd307a7367f140` | `level2-sql/evidence/dp1-data.sanitized.txt` | `6a60c4df3983d9c591f3e1b8b97a73daf0699cf6977dc683df2a5fa3a088c133` | 1 / 0 / 0 |
| `level2-sql/evidence/dp1-full.txt` | `03d0baae5a0d394f533317467d72ed15d9cf093dfef75f31a3473975f7443bb5` | `level2-sql/evidence/dp1-full.sanitized.txt` | `c06c31929d4e409c8116fc00fda874f53b307a56b1225a70ae6cc17d05fdd68c` | 1 / 0 / 0 |
| `level2-sql/evidence/dp1-probe.txt` | `61051d196a0118f61a2558896a713cc87f703324e5bdc894cd10534b3d82d45b` | `level2-sql/evidence/dp1-probe.sanitized.txt` | `7687992d4f9ed4818d4f4e40746fd9a85d8353a817bc986c34affc09570a9f83` | 1 / 0 / 0 |
| `level2-sql/evidence/sql-log.txt` | `a3a648d487782e06a1c4fc933580836555938494a501e05c0f4fd7c9af83c41c` | `level2-sql/evidence/sql-log.sanitized.txt` | `0b815d2a4e1fe632de5abd384cc93e5fe53b0db640cd3a1cdedb8a7dd480e806` | 2 / 0 / 0 |
| `level2-sql/evidence/td1.txt` | `f3f2c1633741b1f1b2ccaee81a4035215d020198bc1f78d6d8f24e786da361bd` | `level2-sql/evidence/td1.sanitized.txt` | `3b1a95045f55f833c043a88d13f14390f98c263cb91c870ed2868aab999e4f96` | 1 / 0 / 0 |
| `level2-sql/evidence/td2.txt` | `5198c9847bcedfac4f7abaed3f9b7cdd19eac5f55e2348fba0a719f4c7c3b6e1` | `level2-sql/evidence/td2.sanitized.txt` | `f6e740796cecb4f3d284192fa8fa194d4692e907e4a54c987f0e416e0f9f257c` | 2 / 0 / 0 |
