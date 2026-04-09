package cr.go.ice.aia.installer.service;

import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.util.Map;

/**
 * Generates the [GA-20-002] installation evidence DOCX document.
 * Replicates the exact structure from the template.
 */
public class DocumentService {

    private DocumentService() {}

    public static byte[] generateEvidenceDoc(Map<String, String> data) throws Exception {
        XWPFDocument doc = new XWPFDocument();

        // Page setup: 12240 x 23040 DXA (letter width, custom height)
        CTSectPr sectPr = doc.getDocument().getBody().addNewSectPr();
        CTPageSz pageSize = sectPr.addNewPgSz();
        pageSize.setW(BigInteger.valueOf(12240));
        pageSize.setH(BigInteger.valueOf(23040));
        CTPageMar margins = sectPr.addNewPgMar();
        margins.setTop(BigInteger.valueOf(1728));
        margins.setRight(BigInteger.valueOf(1440));
        margins.setBottom(BigInteger.valueOf(1440));
        margins.setLeft(BigInteger.valueOf(1440));

        // ── INFORMACIÓN GENERAL table ──────────────────────────────────
        XWPFTable table = doc.createTable();
        table.setWidth("9340");

        // Header row (gray, merged)
        XWPFTableRow headerRow = table.getRow(0);
        setRowHeight(headerRow, 432);
        XWPFTableCell headerCell = headerRow.getCell(0);
        setCellBorders(headerCell);
        setCellShading(headerCell, "D9D9D9");
        setCellVAlign(headerCell, STVerticalJc.CENTER);
        setCellWidth(headerCell, "9340");
        setParagraphText(headerCell.getParagraphs().get(0), "INFORMACIÓN GENERAL",
                true, 13, ParagraphAlignment.CENTER);
        // Merge across 2 columns
        CTTcPr tcPr = headerCell.getCTTc().addNewTcPr();
        tcPr.addNewGridSpan().setVal(BigInteger.valueOf(2));

        // Info rows
        addInfoRow(table, "Fecha de instalación:", data.getOrDefault("installDate", ""));
        addInfoRow(table, "Código de proyecto:", data.getOrDefault("projectCode", ""));
        addInfoRow(table, "Releases instalados:", data.getOrDefault("releaseName", ""));
        addInfoRow(table, "Ejecutado por:", data.getOrDefault("executedBy", ""));
        addInfoRow(table, "Ambiente:", data.getOrDefault("environment", ""));
        addInfoRow(table, "Estado de la instalación:", data.getOrDefault("status", "Exitoso"));
        addInfoRow(table, "Comentarios:", data.getOrDefault("comments", "N/A"));
        addInfoRow(table, "Número de RFC:", data.getOrDefault("rfcNumber", ""));

        // ── Sections ────────────────────────────────────────────────────
        addEmptyParagraph(doc);

        addSectionTitle(doc, "Dependencias del release");
        addTerminalBlock(doc, data.getOrDefault("dependenciesOutput", "(sin datos)"));
        addEmptyParagraph(doc);

        addSectionTitle(doc, "Precondiciones y backup de archivo");
        addTerminalBlock(doc, data.getOrDefault("preConditionsOutput", "(sin datos)"));
        addEmptyParagraph(doc);

        addSectionTitle(doc, "Evidencia de instalación");
        addTerminalBlock(doc, data.getOrDefault("antOutput", "(sin datos)"));
        addEmptyParagraph(doc);

        addSectionTitle(doc, "Postcondiciones");
        addTerminalBlock(doc, data.getOrDefault("postConditionsOutput", "(sin datos)"));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        doc.write(baos);
        doc.close();
        return baos.toByteArray();
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static void addInfoRow(XWPFTable table, String label, String value) {
        XWPFTableRow row = table.createRow();
        setRowHeight(row, 432);

        // Ensure we have exactly 2 cells
        while (row.getTableCells().size() < 2) row.createCell();

        // Label cell
        XWPFTableCell labelCell = row.getCell(0);
        setCellBorders(labelCell);
        setCellVAlign(labelCell, STVerticalJc.CENTER);
        setCellWidth(labelCell, "2603");
        setParagraphText(labelCell.getParagraphs().get(0), label,
                true, 11, ParagraphAlignment.RIGHT);

        // Value cell
        XWPFTableCell valueCell = row.getCell(1);
        setCellBorders(valueCell);
        setCellVAlign(valueCell, STVerticalJc.CENTER);
        setCellWidth(valueCell, "6737");
        setParagraphText(valueCell.getParagraphs().get(0), value,
                false, 11, ParagraphAlignment.LEFT);
    }

    private static void addSectionTitle(XWPFDocument doc, String text) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun run = p.createRun();
        run.setText(text);
        run.setBold(true);
        run.setFontSize(11);
    }

    private static void addTerminalBlock(XWPFDocument doc, String text) {
        if (text == null || text.trim().isEmpty()) {
            text = "(sin datos)";
        }
        String[] lines = text.split("\n");
        for (String line : lines) {
            XWPFParagraph p = doc.createParagraph();
            p.setSpacingBefore(0);
            p.setSpacingAfter(0);
            p.setSpacingBetween(1.0);
            // Left border for terminal-style look
            CTPPr pPr = p.getCTP().addNewPPr();
            CTInd ind = pPr.addNewInd();
            ind.setLeft(BigInteger.valueOf(160));

            XWPFRun run = p.createRun();
            run.setText(line.isEmpty() ? " " : line);
            run.setFontFamily("Courier New");
            run.setFontSize(9);
        }
    }

    private static void addEmptyParagraph(XWPFDocument doc) {
        doc.createParagraph();
    }

    private static void setParagraphText(XWPFParagraph p, String text,
                                          boolean bold, int fontSize, ParagraphAlignment align) {
        p.setAlignment(align);
        p.setSpacingAfter(0);
        p.setSpacingBefore(0);
        // Remove any existing runs
        while (p.getRuns().size() > 0) p.removeRun(0);
        XWPFRun run = p.createRun();
        run.setText(text);
        run.setBold(bold);
        run.setFontSize(fontSize);
        run.setFontFamily("Calibri");
    }

    private static void setCellBorders(XWPFTableCell cell) {
        CTTcPr tcPr = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTTcBorders borders = tcPr.addNewTcBorders();
        for (CTBorder b : new CTBorder[]{
                borders.addNewTop(), borders.addNewBottom(),
                borders.addNewLeft(), borders.addNewRight()}) {
            b.setVal(STBorder.SINGLE);
            b.setSz(BigInteger.valueOf(8));
            b.setSpace(BigInteger.valueOf(0));
            b.setColor("000000");
        }
    }

    private static void setCellShading(XWPFTableCell cell, String color) {
        CTTcPr tcPr = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTShd shd = tcPr.addNewShd();
        shd.setVal(STShd.CLEAR);
        shd.setFill(color);
    }

    private static void setCellVAlign(XWPFTableCell cell, STVerticalJc.Enum align) {
        CTTcPr tcPr = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTVerticalJc vAlign = tcPr.addNewVAlign();
        vAlign.setVal(align);
    }

    private static void setCellWidth(XWPFTableCell cell, String width) {
        CTTcPr tcPr = cell.getCTTc().isSetTcPr() ? cell.getCTTc().getTcPr() : cell.getCTTc().addNewTcPr();
        CTTblWidth w = tcPr.addNewTcW();
        w.setW(BigInteger.valueOf(Long.parseLong(width)));
        w.setType(STTblWidth.DXA);
    }

    private static void setRowHeight(XWPFTableRow row, int twips) {
        CTTrPr trPr = row.getCtRow().addNewTrPr();
        CTHeight ht = trPr.addNewTrHeight();
        ht.setVal(BigInteger.valueOf(twips));
    }
}
