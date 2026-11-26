import importlib.util
import struct
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("gboard_scan", Path(__file__).resolve().parents[1] / "scripts/scan-gboard-apks.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def dex_fixture(strings):
    buf = bytearray(112 + 4 * len(strings))
    buf[:8] = b"dex\n035\0"
    struct.pack_into("<II", buf, 56, len(strings), 112)
    for i, name in enumerate(strings):
        struct.pack_into("<I", buf, 112 + 4 * i, len(buf))
        data = name.encode("ascii")
        assert len(data) < 128
        buf.extend(bytes([len(data)]) + data + b"\0")
    return bytes(buf)

class TestGboardScanner(unittest.TestCase):
    def test_reads_string_id_table(self):
        blob = dex_fixture(["enable_demo_flag", "http://example.com", "pref_sample", "com.google.android.inputmethod.latin"])
        self.assertEqual(module.extract_dex(blob), {"enable_demo_flag", "pref_sample"})

    def test_rejects_malformed_header(self):
        with self.assertRaises(ValueError):
            module.extract_dex(b"not DEX")

    def test_does_not_count_arbitrary_bytecode_fragments(self):
        blob = dex_fixture(["show_real_flag"]) + b"enable_fake_flag\0"
        self.assertEqual(module.extract_dex(blob), {"show_real_flag"})

if __name__ == "__main__":
    unittest.main()
