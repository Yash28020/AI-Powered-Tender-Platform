import * as React from 'react';
import { useState } from 'react';
import { 
  FileText, AlertTriangle, Share2, Edit3, 
  ArrowLeft, Briefcase, TrendingUp, ShieldAlert, 
  BadgeCheck, Table, Download, Eye, FileDown, X
} from 'lucide-react';
import { Rfp, TechnicalAgentOutput, FinancialAgentResult, BlankDoc } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 

interface FinalRecommendationProps {
  rfp: Rfp;
  analysisContext?: any; 
  onBack: () => void;
  onCancel: () => void;
}

export const FinalRecommendation: React.FC<FinalRecommendationProps> = ({ rfp, analysisContext, onBack, onCancel }) => {
  const [remarks, setRemarks] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // --- 1. DATA EXTRACTION & FALLBACKS ---
  const technical = rfp.agentOutputs?.technicalAnalysis as TechnicalAgentOutput;
  const financial = rfp.agentOutputs?.pricing as FinancialAgentResult;
  
  const parsedMetadata = rfp.agentOutputs?.parsedData?.metadata || {};
  const bidNumber = parsedMetadata.bidNumber || rfp.id;
  const department = parsedMetadata.issuingOrganization || rfp.organisation.replace('Parsing...', 'GeM Public Tender');
  
  const rawRisks = rfp.agentOutputs?.parsedData?.riskAnalysis || financial?.riskEntries;
  const riskList = Array.isArray(rawRisks) ? rawRisks : [];
  
  const calc = analysisContext?.liveCalculations || {};
  const docs = analysisContext?.blankDocs || [];
  const marginPercent = analysisContext?.profitMargin || 15;
  const logisticsPercent = calc.materialBase ? ((calc.logistics / calc.materialBase) * 100).toFixed(1) : 0;
  const finalValue = calc.finalTotal || financial?.summary?.finalBidValue || 0;

  // --- 2. VERDICT LOGIC ---
  const bidScore = (() => {
    if (!technical || !financial) return 0;
    const techScore = technical.itemAnalyses.reduce((acc, item) => acc + (item.selectedSku?.matchPercentage || 0), 0) / (technical.itemAnalyses.length || 1);
    const finScore = Math.min(marginPercent * 5, 100); 
    const riskScore = riskList.some((r: any) => r.riskLevel === 'High') ? 0 : riskList.some((r: any) => r.riskLevel === 'Medium') ? 50 : 100;
    return Math.round((techScore * 0.5) + (finScore * 0.3) + (riskScore * 0.2));
  })();

  const verdict = bidScore >= 70 ? 'BID' : bidScore >= 40 ? 'REVIEW' : 'NO-BID';

  // --- 3. SYSTEM DOCUMENT GENERATORS ---
  const handleDownloadSystemDoc = (type: 'TECH' | 'FIN') => {
    let csvContent = "";
    let filename = "";

    if (type === 'TECH') {
      filename = `TenderFlow_${bidNumber}_Tech_Matrix.csv`;
      const rows = [
        ['RFP Requirement', 'Required Qty', 'Matched SKU', 'Internal Product Name', 'Match %'],
        ...(technical?.itemAnalyses.map(item => [
          `"${item.rfpLineItem.name.replace(/"/g, '""')}"`,
          item.rfpLineItem.quantity,
          `"${item.selectedSku?.skuId || 'N/A'}"`,
          `"${item.selectedSku?.productName?.replace(/"/g, '""') || 'No Match'}"`,
          `${item.selectedSku?.matchPercentage || 0}%`
        ]) || [])
      ];
      csvContent = rows.map(e => e.join(",")).join("\n");
    } else {
      filename = `TenderFlow_${bidNumber}_Financial_BoQ.csv`;
      const rows = [
        ['Cost Component', 'Calculated Amount (INR)', 'Notes'],
        ['Base Material Cost', Math.round(calc.materialBase || 0), 'Sum of all matched SKUs'],
        ['Testing & Acceptance Services', Math.round(calc.testing || 0), 'Laboratory testing provisions'],
        ['Total GST', Math.round(calc.gst || 0), 'Calculated per item'],
        ['Logistics (w/ Buffer)', Math.round(calc.logistics || 0), 'Based on distance/rate'],
        ['GeM Brokerage Fee', Math.round(calc.gemFee || 0), 'Standard platform fee'],
        ['EMD Provision', Math.round(calc.emd || 0), 'Earnest Money Deposit'],
        ['EPBG Provision', Math.round(calc.epbg || 0), 'Performance Guarantee'],
        [`Net Profit (${marginPercent}%)`, Math.round(calc.profit || 0), 'Target margin'],
        ['', '', ''],
        ['FINAL AUTHORIZED BID', Math.round(finalValue), 'Total loaded value']
      ];
      csvContent = rows.map(e => e.join(",")).join("\n");
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); 
  };

  // --- MASTER DOWNLOAD PACKET ---
  const handleDownloadAll = () => {
    handleDownloadSystemDoc('TECH');
    setTimeout(() => handleDownloadSystemDoc('FIN'), 500);

    docs.forEach((doc: BlankDoc, idx: number) => {
      setTimeout(() => {
        if (doc.status === 'CONVERTED_TO_DOCX' && doc.docxUrl) {
          window.open(doc.docxUrl, '_blank');
        } else if (doc.url) {
          window.open(doc.url, '_blank');
        }
      }, (idx + 2) * 600); 
    });
  };

  // --- 4. MASTER PDF REPORT ENGINE ---
  const generatePremiumPDF = () => {
    const doc = new jsPDF();
    
    // PAGE 1: EXECUTIVE SUMMARY & RISKS
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
    doc.setTextColor(212, 175, 55); 
    doc.setFontSize(24);
    doc.setFont("helvetica", "bolditalic");
    doc.text("TENDERFLOW", 14, 22);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("FINAL EXECUTIVE RECOMMENDATION", 14, 32);
    
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 50);
    doc.setFont("helvetica", "bold");
    doc.text(`Tender ID: ${bidNumber}`, 14, 58);
    doc.setFont("helvetica", "normal");
    doc.text(`Organization: ${department}`, 14, 64);
    doc.text(`System Verdict: ${verdict} (Score: ${bidScore}/100)`, 14, 70);
    
    if (remarks) {
      doc.setFont("helvetica", "italic");
      doc.text(`Executive Remarks: ${remarks}`, 14, 80, { maxWidth: 180 });
      doc.setFont("helvetica", "normal");
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("1. Risk Assessment Matrix", 14, remarks ? 100 : 90);
    const riskData = riskList.length > 0 
      ? riskList.map((r: any) => [r.category, r.riskLevel, r.statement])
      : [['System', 'Low', 'No significant risks identified during analysis.']];
    
    autoTable(doc, {
      startY: remarks ? 105 : 95,
      head: [['Category', 'Risk Level', 'Statement']],
      body: riskData,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38] }, // Red 600
      styles: { fontSize: 9 }
    });

    // PAGE 2: TECHNICAL MATCHING
    doc.addPage();
    doc.setFontSize(16);
    doc.text("2. Technical Compliance & SKUs", 14, 22);
    
    const techData = technical?.itemAnalyses.map(item => [
      item.rfpLineItem.name,
      item.rfpLineItem.quantity,
      item.selectedSku?.skuId || "N/A",
      item.selectedSku?.productName || "No Exact Match",
      `${item.selectedSku?.matchPercentage || 0}%`
    ]) || [];

    autoTable(doc, {
      startY: 30,
      head: [['RFP Requirement', 'Qty', 'SKU', 'Internal Product', 'Match %']],
      body: techData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }, // Slate 800
      styles: { fontSize: 9 }
    });

    // PAGE 3: FINANCIAL BREAKDOWN
    doc.addPage();
    doc.setFontSize(16);
    doc.text("3. Financial Projections", 14, 22);

    const finData = [
      ["Base Material Cost", `Rs. ${Math.round(calc.materialBase || 0).toLocaleString()}`],
      ["Logistics & Buffer", `Rs. ${Math.round(calc.logistics || 0).toLocaleString()}`],
      ["Total GST", `Rs. ${Math.round(calc.gst || 0).toLocaleString()}`],
      ["GeM Brokerage Fee", `Rs. ${Math.round(calc.gemFee || 0).toLocaleString()}`],
      ["Required EMD Provision", `Rs. ${Math.round(calc.emd || 0).toLocaleString()}`],
      ["Required EPBG Provision", `Rs. ${Math.round(calc.epbg || 0).toLocaleString()}`],
      ["Testing & Acceptance Cost", `Rs. ${Math.round(calc.testing || 0).toLocaleString()}`],
      [`Net Profit (${marginPercent}%)`, `Rs. ${Math.round(calc.profit || 0).toLocaleString()}`],
      ["FINAL AUTHORIZED BID", `Rs. ${Math.round(finalValue).toLocaleString()}`]
    ];

    autoTable(doc, {
      startY: 30,
      head: [['Cost Component', 'Calculated Amount']],
      body: finData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
      styles: { fontSize: 10 },
      didParseCell: function(data: any) {
        if (data.row.index === finData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    return doc;
  };

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const doc = generatePremiumPDF();
        doc.save(`TenderFlow_Recommendation_${bidNumber}.pdf`);
      } catch (err) {
        console.error("PDF Error", err);
      } finally {
        setIsGenerating(false);
      }
    }, 100); 
  };

  const handleShare = async () => {
    setIsGenerating(true);
    setTimeout(async () => {
      try {
        const doc = generatePremiumPDF();
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `TenderFlow_Recommendation_${bidNumber}.pdf`, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Recommendation: ${bidNumber}`,
            text: `TenderFlow Executive Summary for ${bidNumber}. Verdict: ${verdict} | Final Value: ₹${Math.round(finalValue).toLocaleString()}`,
            files: [file]
          });
        } else {
          alert("Direct sharing not supported on this browser. Downloading instead.");
          doc.save(`TenderFlow_Recommendation_${bidNumber}.pdf`);
        }
      } catch (err) {
        console.error("Share Error", err);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };


  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col font-sans">
      
      {/* HEADER (FIXED WITH EXPORT BUTTONS) */}
      <div className="shrink-0 flex items-center justify-between bg-slate-900/40 p-5 border-b border-slate-800 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
              Final Recommendation
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                verdict === 'BID' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' :
                verdict === 'REVIEW' ? 'bg-amber-500/10 border-amber-500 text-amber-400' :
                'bg-red-500/10 border-red-500 text-red-400'
              }`}>
                {verdict} Recommended
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">REF: {bidNumber} • {department}</p>
          </div>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex gap-3">
           <button 
             onClick={handleShare} 
             disabled={isGenerating} 
             className="bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
           >
             <Share2 className="w-3.5 h-3.5" /> Share
           </button>
           
           <button 
            onClick={handleDownloadPDF} 
            disabled={isGenerating} 
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-white text-slate-950 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
            {isGenerating ? 'Exporting...' : <><Download className="w-3.5 h-3.5" /> Export PDF</>}
          </button>
         </div>
      </div>

      {/* SCROLLABLE MAIN CONTENT */}
      <div className="flex-grow overflow-y-auto scrollbar-hide px-8 pt-8 pb-12 relative z-10">
        <div className="grid grid-cols-12 gap-6 max-w-[1600px] mx-auto">
          
          {/* LEFT COL: ANALYSIS SUMMARY (8 Cols) */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
            
            {/* 1. TECHNICAL MATCH CARD */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-emerald-500" /> Technical Feasibility
                </h3>
                <span className="text-2xl font-bold text-white">{Math.round(bidScore)}<span className="text-sm text-slate-500">/100</span></span>
              </div>

              <div className="space-y-4 max-h-[250px] overflow-y-auto scrollbar-hide pr-2">
                {technical?.itemAnalyses.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-slate-400">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.rfpLineItem.name}</p>
                        <p className="text-xs text-slate-400">Matched: <span className="text-blue-400">{item.selectedSku?.productName || "No Match"}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        (item.selectedSku?.matchPercentage || 0) > 80 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {item.selectedSku?.matchPercentage || 0}%
                      </div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Spec Match</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. RISK & REMARKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Risk Factors */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> Risk Assessment
                </h3>
                <div className="space-y-3">
                  {riskList.length > 0 ? riskList.map((risk: any, i: number) => (
                    <div key={i} className="flex gap-3 items-start p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                        risk.riskLevel === 'High' ? 'text-red-500' : 'text-amber-500'
                      }`} />
                      <div>
                        <p className="text-xs font-bold text-slate-200">{risk.category} Risk</p>
                        <p className="text-[10px] text-slate-400 leading-tight mt-1">{risk.statement}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-500 text-xs italic">No significant risks detected in analysis.</div>
                  )}
                </div>
              </div>

              {/* Editable Remarks */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-500" /> Executive Remarks
                  </h3>
                  <button 
                    onClick={() => setIsEditing(!isEditing)} 
                    className="text-[10px] font-bold text-blue-400 hover:text-white transition-colors uppercase"
                  >
                    {isEditing ? 'Save Note' : 'Edit'}
                  </button>
                </div>
                
                {isEditing ? (
                  <textarea 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter final decision rationale..."
                    className="flex-grow w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none resize-none"
                  />
                ) : (
                  <div className="flex-grow bg-slate-950/50 rounded-xl p-4 border border-slate-800 text-sm text-slate-400 italic">
                    {remarks || "No additional remarks added. Click Edit to add operator context."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COL: FINANCIALS & DOCS (5 Cols) */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            
            {/* 1. FINANCIAL SUMMARY */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/10 blur-[50px] rounded-full pointer-events-none" />
              
              <h3 className="text-sm font-black text-gold-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Final Projections
              </h3>

              <div className="space-y-6">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Est. Contract Value</p>
                  <p className="text-3xl font-mono font-bold text-white mt-1">
                    ₹{Math.round(finalValue).toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Margin</p>
                    <p className="text-lg font-bold text-emerald-400">{marginPercent}%</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Logistics Cost</p>
                    <p className="text-lg font-bold text-slate-200">{logisticsPercent}%</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <p className="text-[10px] text-slate-400 mb-2">Confidence Score</p>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-emerald-400" 
                      style={{ width: `${financial?.summary?.confidenceScore || 75}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. DYNAMIC DOCUMENT HUB */}
            <div className="flex-grow bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                   <Briefcase className="w-4 h-4 text-blue-500" /> Editable Bid Documents
                 </h3>
                 <button 
                    onClick={handleDownloadAll} 
                    className="px-4 py-2 bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600 text-blue-400 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 shadow-md"
                 >
                   <FileDown className="w-3 h-3" /> Download Packet
                 </button>
              </div>

              <div className="space-y-3 flex-grow overflow-y-auto max-h-[350px] scrollbar-hide pr-2">
                
                {/* 1. AUTO-GENERATED SYSTEM DOCS */}
                <div className="group flex flex-col p-4 bg-slate-950 border border-gold-500/30 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-gold-500 text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase">System Generated</div>
                  <div className="flex items-center gap-3 mb-3 mt-1">
                    <div className="p-2 rounded-lg bg-emerald-900/20 text-emerald-400"><Table className="w-5 h-5" /></div>
                    <div>
                      <p className="text-xs font-bold text-white">Financial BoQ</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest">Excel / CSV Format</p>
                    </div>
                  </div>
                  <button onClick={() => handleDownloadSystemDoc('FIN')} className="w-full py-2 flex justify-center items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                    <Download className="w-3 h-3" /> Download & Edit
                  </button>
                </div>

                <div className="group flex flex-col p-4 bg-slate-950 border border-gold-500/30 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-gold-500 text-slate-950 text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase">System Generated</div>
                  <div className="flex items-center gap-3 mb-3 mt-1">
                    <div className="p-2 rounded-lg bg-emerald-900/20 text-emerald-400"><Table className="w-5 h-5" /></div>
                    <div>
                      <p className="text-xs font-bold text-white">Technical Compliance Matrix</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest">Excel / CSV Format</p>
                    </div>
                  </div>
                  <button onClick={() => handleDownloadSystemDoc('TECH')} className="w-full py-2 flex justify-center items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                    <Download className="w-3 h-3" /> Download & Edit
                  </button>
                </div>

                {/* 2. DOCUMENTS EXTRACTED/CONVERTED FROM ANALYSIS SCREEN */}
                {docs.length > 0 ? docs.map((doc: BlankDoc, i: number) => (
                   <div key={i} className="group flex flex-col p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${doc.status === 'CONVERTED_TO_DOCX' ? 'bg-emerald-900/20 text-emerald-400' : 'bg-slate-800 text-slate-300'}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white line-clamp-1">{doc.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest">{doc.status === 'CONVERTED_TO_DOCX' ? 'Word Document' : 'Original PDF'}</p>
                        </div>
                      </div>
                      
                      {doc.status === 'CONVERTED_TO_DOCX' ? (
                        <button onClick={() => { if(doc.docxUrl) window.open(doc.docxUrl, '_blank'); }} className="w-full py-2 flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                          <Download className="w-3 h-3" /> Download & Edit
                        </button>
                      ) : (
                        <button onClick={() => window.open(doc.url, '_blank')} className="w-full py-2 flex items-center justify-center gap-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                          <Eye className="w-3 h-3" /> Preview File
                        </button>
                      )}
                   </div>
                )) : (
                  <div className="text-center py-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest border border-dashed border-slate-800 rounded-xl">
                     No external documents forwarded.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* FLOATING ABORT BUTTON */}
      <button 
        onClick={onCancel} 
        className="fixed bottom-8 left-8 z-50 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 backdrop-blur-md"
      >
        <X className="w-4 h-4" /> Abort Pipeline
      </button>

      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};