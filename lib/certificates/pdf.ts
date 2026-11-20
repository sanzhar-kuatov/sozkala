import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, PDFString, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { BUILDINGS } from "@/lib/domain/buildings";
import { TIER_COLOR, type Tier } from "./rules";
import type { CertificateSnapshot } from "./service";

export type PdfLabels = {
  brand: string;
  heading: string;
  awardedTo: string;
  body: string;
  finalScore: string;
  issued: string;
  verify: string;
  tier: string;
};

export type PdfInput = {
  snapshot: CertificateSnapshot;
  serial: string;
  tier: Tier;
  finalScore: number;
  issuedAt: string; // already formatted for the locale
  verifyUrl: string;
  locale: "kk" | "ru";
  labels: PdfLabels;
};

const W = 841.89; // A4 landscape, points
const H = 595.28;

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const INK = hex("#1B2433");
const MUTED = hex("#5B6678");
const SKY = hex("#0096AE");
const CREAM = hex("#FFF8EC");
const LINE = hex("#E3DCCB");
const WHITE = rgb(1, 1, 1);

let fontCache: Promise<Uint8Array[]> | null = null;
const fontFiles = () =>
  (fontCache ??= Promise.all(
    ["Rubik-ExtraBold.ttf", "Nunito-ExtraBold.ttf", "Nunito-SemiBold.ttf"].map(
      async (f) => new Uint8Array(await readFile(path.join(process.cwd(), "assets", "fonts", f))),
    ),
  ));

/** Text centred on x, shrunk until it fits `maxWidth`. */
function centered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
  maxWidth = W - 160,
  cx = W / 2,
) {
  let s = size;
  while (s > 8 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, s) / 2, y, size: s, font, color });
}

/**
 * «СӨЗҚАЛАНЫҢ БАС СӘУЛЕТШІСІ» certificate (wireframe §7): A4 landscape with the
 * title, name, class, date, final score, tier seal, a mini skyline of the
 * student's city, the serial and a QR code to /verify/{code}.
 */
export async function renderCertificatePdf(input: PdfInput): Promise<Uint8Array> {
  const { snapshot, labels } = input;
  const accent = hex(TIER_COLOR[input.tier]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [rubikB, nunitoB, nunito] = await Promise.all(
    (await fontFiles()).map((bytes) => doc.embedFont(bytes, { subset: true })),
  );
  const title = input.locale === "kk" ? snapshot.titleKk : snapshot.titleRu;
  doc.setTitle(`${title} · ${input.serial}`);
  doc.setAuthor(labels.brand);
  doc.setCreator(labels.brand);
  doc.setSubject(input.verifyUrl); // the QR target, also readable by tools (and the e2e test)

  const page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: accent, borderWidth: 4 });
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: LINE, borderWidth: 1 });

  // header
  page.drawText(labels.brand, { x: 56, y: H - 66, size: 13, font: rubikB, color: SKY });
  const serial = `№ ${input.serial}`;
  page.drawText(serial, {
    x: W - 56 - nunitoB.widthOfTextAtSize(serial, 11),
    y: H - 66,
    size: 11,
    font: nunitoB,
    color: MUTED,
  });

  // body
  centered(page, labels.heading, H - 120, nunitoB, 15, INK);
  page.drawRectangle({ x: W / 2 - 28, y: H - 132, width: 56, height: 3, color: accent });
  centered(page, title, H - 168, rubikB, 34);
  centered(page, labels.awardedTo, H - 208, nunito, 13, MUTED);
  centered(page, snapshot.name, H - 250, nunitoB, 32, SKY);
  const meta = [snapshot.className, snapshot.school].filter(Boolean).join(" · ");
  if (meta) centered(page, meta, H - 276, nunito, 13, MUTED);
  centered(page, labels.body, H - 310, nunito, 13, INK, 600);

  // seal (left)
  const sx = 140;
  const sy = 150;
  page.drawCircle({ x: sx, y: sy, size: 58, color: accent });
  page.drawCircle({ x: sx, y: sy, size: 50, borderColor: WHITE, borderWidth: 2 });
  centered(page, labels.tier, sy + 12, rubikB, 13, INK, 86, sx);
  centered(page, `${input.finalScore}/10`, sy - 14, nunitoB, 20, INK, 86, sx);
  centered(page, labels.finalScore, sy - 78, nunitoB, 10, MUTED, 130, sx);

  // mini skyline of the student's city (centre)
  const levels = BUILDINGS.map((b) => snapshot.levels[b.key] ?? 0);
  const bw = 34;
  const gap = 10;
  const total = levels.length * bw + (levels.length - 1) * gap;
  const x0 = W / 2 - total / 2;
  const base = 110;
  page.drawLine({ start: { x: x0 - 20, y: base }, end: { x: x0 + total + 20, y: base }, thickness: 1.5, color: LINE });
  levels.forEach((lv, i) => {
    const x = x0 + i * (bw + gap);
    const h = 10 + lv * 16;
    page.drawRectangle({ x, y: base, width: bw, height: h, color: hex("#BFE9F0") });
    page.drawRectangle({ x, y: base + h - 5, width: bw, height: 5, color: lv >= 5 ? accent : SKY });
    for (let r = 0; r < Math.floor((h - 14) / 14); r++) {
      for (const dx of [8, 20]) {
        page.drawRectangle({ x: x + dx, y: base + 6 + r * 14, width: 6, height: 7, color: WHITE });
      }
    }
  });
  centered(page, `${labels.issued}: ${input.issuedAt}`, 76, nunitoB, 12, INK);

  // QR (right) — vector modules, links to the public verify page
  const qr = QRCode.create(input.verifyUrl, { errorCorrectionLevel: "M" });
  const qs = 104;
  const qx = W - 56 - qs;
  const qy = 92;
  const cell = qs / qr.modules.size;
  page.drawRectangle({ x: qx - 6, y: qy - 6, width: qs + 12, height: qs + 12, color: WHITE });
  for (let r = 0; r < qr.modules.size; r++) {
    for (let c = 0; c < qr.modules.size; c++) {
      if (qr.modules.get(r, c)) {
        page.drawRectangle({
          x: qx + c * cell,
          y: qy + qs - (r + 1) * cell,
          width: cell + 0.2,
          height: cell + 0.2,
          color: INK,
        });
      }
    }
  }
  centered(page, labels.verify, qy - 22, nunitoB, 10, MUTED, qs + 40, qx + qs / 2);
  // the QR is also a clickable link in PDF viewers
  const link = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [qx, qy, qx + qs, qy + qs],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(input.verifyUrl) },
    }),
  );
  page.node.addAnnot(link);

  return doc.save();
}
