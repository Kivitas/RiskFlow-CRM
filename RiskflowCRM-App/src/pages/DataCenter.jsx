import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, BrainCircuit, FileSpreadsheet, FileText, TableProperties, Upload, Download, DatabaseZap, SendToBack } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DATASETS, IMPORT_TARGETS, exportRowsToCsv, exportRowsToOds, exportRowsToPdf, getDatasetByKey, importRowsToDataset, parseSpreadsheetFile } from '@/lib/dataPortability';
import { toast } from '@/components/ui/use-toast';

function StatBlock({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
    </div>
  );
}

export default function DataCenter() {
  const queryClient = useQueryClient();
  const [datasetKey, setDatasetKey] = useState('contacts');
  const [importTargetKey, setImportTargetKey] = useState('contacts');
  const [importPreview, setImportPreview] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const activeDataset = getDatasetByKey(datasetKey);
  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['data-center', datasetKey],
    queryFn: () => activeDataset.fetcher(),
  });

  const previewColumns = useMemo(() => {
    if (!rows.length) {
      return [];
    }
    return Object.keys(rows[0]).slice(0, 8);
  }, [rows]);

  const importColumns = importPreview?.columns || [];
  const importSample = importPreview?.rows?.slice(0, 10) || [];

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const preview = await parseSpreadsheetFile(file);
      setImportPreview({
        ...preview,
        fileName: file.name,
      });
      setImportResult(null);
    } catch (error) {
      toast({ title: 'Import preview failed', description: error.message || 'Could not read the spreadsheet file.', variant: 'destructive' });
    } finally {
      event.target.value = '';
    }
  };

  const handleImportRows = async () => {
    if (!importPreview?.rows?.length) {
      toast({ title: 'No rows to import', description: 'Upload a CSV or ODS file first.' });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importRowsToDataset(importTargetKey, importPreview.rows);
      setImportResult(result);
      await queryClient.invalidateQueries({ queryKey: ['data-center'] });
      toast({
        title: result.analysisOnly ? 'Ready for analysis' : `${result.imported} rows imported`,
        description: result.analysisOnly ? 'No workspace records were changed.' : result.failed ? `${result.failed} rows need review.` : `Imported into ${result.target.label}.`,
        variant: result.analysisOnly || result.imported ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({ title: 'Import failed', description: error.message || 'Could not import rows.', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const copyAiAnalysisPrompt = async () => {
    const columns = importColumns.join(', ') || 'No columns detected';
    const sample = JSON.stringify(importSample.slice(0, 5), null, 2);
    const prompt = [
      'Analyse this uploaded business spreadsheet for RiskFlow CRM.',
      'Find data quality issues, missing fields, duplicate records, inventory risks, sales trends, report insights, customer follow-up ideas, and useful import mapping suggestions.',
      `Columns: ${columns}`,
      `Sample rows: ${sample}`,
    ].join('\n\n');
    await navigator.clipboard.writeText(prompt);
    toast({ title: 'AI prompt copied', description: 'Open the AI Assistant and paste it for spreadsheet analysis.' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Center"
        subtitle="One hub for importing, exporting, and analysing contacts, reports, inventory, sales, finance, and external CSV/ODS files."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <StatBlock label="Active Dataset" value={activeDataset.label} note="Choose any workspace table to export." />
        <StatBlock label="Live Rows" value={rows.length.toLocaleString()} note={isFetching ? 'Refreshing now' : 'Current records available'} />
        <StatBlock label="Import Preview" value={(importPreview?.rows?.length || 0).toLocaleString()} note={importPreview ? importPreview.fileName : 'No spreadsheet loaded'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)]"
        >
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-950">Import / Export Hub</h3>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Export Dataset</label>
              <select
                value={datasetKey}
                onChange={(event) => setDatasetKey(event.target.value)}
                className="mt-2 flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
              >
                {DATASETS.map((dataset) => (
                  <option key={dataset.key} value={dataset.key}>{dataset.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => exportRowsToCsv(rows, activeDataset.label.toLowerCase().replace(/\s+/g, '-'))}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => exportRowsToOds(rows, activeDataset.label.toLowerCase().replace(/\s+/g, '-'))}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                ODS
              </Button>
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => exportRowsToPdf({
                rows,
                label: activeDataset.label.toLowerCase().replace(/\s+/g, '-'),
                title: activeDataset.label,
                subtitle: 'Exported from RiskFlow Data Center',
              })}>
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-900">Dataset Preview</p>
              </div>
              <ScrollArea className="mt-4 h-[360px]">
                <div className="min-w-[720px]">
                  {rows.length ? (
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b border-slate-200">
                          {previewColumns.map((column) => (
                            <th key={column} className="px-3 py-2 font-semibold text-slate-600">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 15).map((row, rowIndex) => (
                          <tr key={row.id || rowIndex} className="border-b border-slate-100">
                            {previewColumns.map((column) => (
                              <td key={column} className="px-3 py-2 text-slate-700">{String(row[column] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-16 text-center text-sm text-slate-500">No records available for this dataset.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)]"
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-950">Spreadsheet Import Studio</h3>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Upload CSV or Excel files, preview detected rows, then import into supported workspace tables.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px]">
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 transition-colors hover:bg-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-900">Upload CSV / ODS</p>
                <p className="mt-1 text-xs text-slate-500">Use this for contacts, reports from other systems, inventory lists, sales files, or finance data.</p>
              </div>
              <Input type="file" accept=".csv,.ods" className="hidden" onChange={handleFile} />
              <span className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">Choose File</span>
            </label>
            <div>
              <label className="text-sm font-medium text-slate-700">Import Into</label>
              <select
                value={importTargetKey}
                onChange={(event) => setImportTargetKey(event.target.value)}
                className="mt-2 flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
              >
                {IMPORT_TARGETS.map((target) => (
                  <option key={target.key} value={target.key}>{target.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={handleImportRows} disabled={!importPreview?.rows?.length || isImporting} className="rounded-xl">
              <SendToBack className="mr-2 h-4 w-4" />
              {isImporting ? 'Processing...' : importTargetKey === 'analysis' ? 'Mark For Analysis' : 'Import Rows'}
            </Button>
            {importResult && (
              <p className="text-sm text-slate-600">
                {importResult.analysisOnly ? 'Analysis only; no records changed.' : `Imported ${importResult.imported}; failed ${importResult.failed}.`}
              </p>
            )}
          </div>

          {importPreview?.rows?.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => exportRowsToCsv(importPreview.rows, `${importPreview.fileName || 'uploaded-data'}-cleaned`)}>
                <Download className="mr-2 h-4 w-4" />Export Upload CSV
              </Button>
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => exportRowsToOds(importPreview.rows, `${importPreview.fileName || 'uploaded-data'}-cleaned`)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Export Upload ODS
              </Button>
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={() => exportRowsToPdf({ rows: importPreview.rows, label: `${importPreview.fileName || 'uploaded-data'}-report`, title: 'Uploaded Data Analysis', subtitle: 'Generated from RiskFlow Data Center' })}>
                <FileText className="mr-2 h-4 w-4" />Export Upload PDF
              </Button>
            </div>
          ) : null}

          {importResult?.errors?.length ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">Rows needing review</p>
              <p className="mt-1">
                {importResult.errors.slice(0, 4).map((error) => `Row ${error.row}: ${error.message}`).join(' | ')}
                {importResult.errors.length > 4 ? ` | ${importResult.errors.length - 4} more` : ''}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatBlock label="Rows" value={(importPreview?.rows?.length || 0).toLocaleString()} note="Parsed from first sheet" />
            <StatBlock label="Columns" value={importColumns.length.toLocaleString()} note="Detected headers" />
            <StatBlock label="Sheet" value={importPreview?.sheetName || '-'} note={importPreview?.fileName || 'No file loaded'} />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-900">Preview Table</p>
            </div>
            <ScrollArea className="mt-4 h-[300px]">
              <div className="min-w-[720px]">
                {importSample.length ? (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b border-slate-200">
                        {importColumns.map((column) => (
                          <th key={column} className="px-3 py-2 font-semibold text-slate-600">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importSample.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-slate-100">
                          {importColumns.map((column) => (
                            <td key={column} className="px-3 py-2 text-slate-700">{String(row[column] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-16 text-center text-sm text-slate-500">Upload a spreadsheet to preview its rows here.</div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-start gap-3">
              <BrainCircuit className="mt-0.5 h-4 w-4 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">AI / Data Analysis</p>
                <p className="mt-1 text-sm text-slate-600">
                  Copy an analysis prompt for OpenAI, Gemini, or Anthropic to summarize external reports, detect inventory risks, clean columns, and draft customer follow-ups.
                </p>
                <Button variant="outline" className="mt-3 rounded-xl border-blue-200 bg-white" onClick={copyAiAnalysisPrompt} disabled={!importSample.length}>
                  <BrainCircuit className="mr-2 h-4 w-4" />
                  Copy AI Analysis Prompt
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
