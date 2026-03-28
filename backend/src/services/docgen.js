const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  HeadingLevel,
  PageOrientation,
} = require('docx');

/**
 * Generates the [GA-20-002] Installation Evidence document.
 * Replicates the exact structure from the template.
 */
async function generateEvidenceDoc(data) {
  const {
    installDate,
    projectCode,
    releaseName,
    executedBy,
    environment,
    status,
    comments,
    rfcNumber,
    dependenciesOutput,
    antOutput,
    preConditionsOutput,
    postConditionsOutput,
  } = data;

  // ── Border style used for all table cells ──────────────────────────────
  const cellBorder = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
  const allBorders = {
    top: cellBorder,
    bottom: cellBorder,
    left: cellBorder,
    right: cellBorder,
  };

  // ── Helper: header cell (gray background) ─────────────────────────────
  function headerCell(text) {
    return new TableCell({
      borders: allBorders,
      columnSpan: 2,
      shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      width: { size: 9340, type: WidthType.DXA },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 0, line: 240, lineRule: 'auto' },
          children: [new TextRun({ text, bold: true, size: 26 })],
        }),
      ],
    });
  }

  // ── Helper: info row (label | value) ──────────────────────────────────
  function infoRow(label, value) {
    return new TableRow({
      height: { value: 432, rule: 'exact' },
      children: [
        new TableCell({
          borders: allBorders,
          width: { size: 2603, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 0, line: 240, lineRule: 'auto' },
              children: [new TextRun({ text: label, bold: true })],
            }),
          ],
        }),
        new TableCell({
          borders: allBorders,
          width: { size: 6737, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { after: 0, line: 240, lineRule: 'auto' },
              children: [new TextRun({ text: String(value || '') })],
            }),
          ],
        }),
      ],
    });
  }

  // ── Helper: section title ─────────────────────────────────────────────
  function sectionTitle(text) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true })],
      spacing: { after: 120 },
    });
  }

  // ── Helper: terminal output block (monospace, dark feel) ──────────────
  function terminalBlock(text) {
    if (!text || text.trim() === '') {
      return [
        new Paragraph({
          children: [new TextRun({ text: '(sin datos)', italics: true, color: '888888' })],
          spacing: { after: 80 },
        }),
      ];
    }

    // Split into lines (max 120 chars wide for readability)
    const lines = text.split('\n');
    return lines.map(line =>
      new Paragraph({
        children: [
          new TextRun({
            text: line || ' ',
            font: 'Courier New',
            size: 18, // 9pt
            color: '000000',
          }),
        ],
        spacing: { before: 0, after: 0, line: 200, lineRule: 'auto' },
        border: {
          left: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA', space: 4 },
        },
        indent: { left: 160 },
      })
    );
  }

  // ── INFORMACIÓN GENERAL table ─────────────────────────────────────────
  const infoTable = new Table({
    width: { size: 9340, type: WidthType.DXA },
    columnWidths: [2603, 6737],
    rows: [
      new TableRow({
        height: { value: 432, rule: 'exact' },
        children: [headerCell('INFORMACIÓN GENERAL')],
      }),
      infoRow('Fecha de instalación:', installDate),
      infoRow('Código de proyecto:', projectCode),
      infoRow('Releases instalados:', releaseName),
      infoRow('Ejecutado por:', executedBy),
      infoRow('Ambiente:', environment),
      infoRow('Estado de la instalación:', status),
      infoRow('Comentarios:', comments),
      infoRow('Número de RFC:', rfcNumber),
    ],
  });

  // ── Document sections ─────────────────────────────────────────────────
  const children = [
    infoTable,
    new Paragraph({ children: [], spacing: { after: 240 } }),

    // Section 1: Dependencias
    sectionTitle('Dependencias del release'),
    ...terminalBlock(dependenciesOutput),
    new Paragraph({ children: [], spacing: { after: 240 } }),

    // Section 2: Precondiciones y backup
    sectionTitle('Precondiciones y backup de archivo'),
    ...terminalBlock(preConditionsOutput),
    new Paragraph({ children: [], spacing: { after: 240 } }),

    // Section 3: Evidencia de instalación
    sectionTitle('Evidencia de instalación'),
    ...terminalBlock(antOutput),
    new Paragraph({ children: [], spacing: { after: 240 } }),

    // Section 4: Postcondiciones
    sectionTitle('Postcondiciones'),
    ...terminalBlock(postConditionsOutput),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240,
              height: 23040,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 1728,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateEvidenceDoc };
