'use client';
import 'regenerator-runtime/runtime';
import React, { useState } from 'react';
import NavBar from '@/components/NavBar';
import { read, utils } from 'xlsx';  // For XLSX file handling
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import fontkit from '@pdf-lib/fontkit';

const Page = () => {
    const [file, setFile] = useState<File | null>(null);
    const [message, setMessage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFile(event.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('❌ Please upload a CSV or XLSX file.');
            return;
        }

        setLoading(true);
        setMessage('⏳ Processing file...');

        try {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    let data: any;
                    const fileData = new Uint8Array(e.target?.result as ArrayBuffer);

                    if (file.name.endsWith('.csv')) {
                        const csvData = new TextDecoder().decode(fileData);
                        data = utils.csv_to_sheet(csvData);
                    } else {
                        const workbook = read(fileData, { type: 'array' });
                        const sheet = workbook.Sheets[workbook.SheetNames[0]];
                        data = utils.sheet_to_json(sheet);
                    }

                    if (!data.length) {
                        setMessage('❌ No data found in the file.');
                        setLoading(false);
                        return;
                    }

                    data.sort((a, b) => a['CENTER CODE'] - b['CENTER CODE']);
                    await generatePDFs(data);
                } catch (error) {
                    setMessage(`❌ Error processing file: ${error.message}`);
                    setLoading(false);
                }
            };

            reader.readAsArrayBuffer(file);
        } catch (error) {
            setMessage(`❌ Unexpected error: ${error.message}`);
            setLoading(false);
        }
    };

    const generatePDFs = async (data) => {
        setMessage('⏳ Generating PDFs...');
        const zip = new JSZip();
    
        const createPDF = async (centerCode, centerName, location, examDate, rows) => {
            let pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
    
            // **Load Regular and Bold Fonts**
            const fontBytes = await fetch('/NotoSansDevanagari-Regular.ttf').then(res => res.arrayBuffer());
            const boldFontBytes = await fetch('/NotoSansDevanagari-Bold.ttf').then(res => res.arrayBuffer());
    
            const font = await pdfDoc.embedFont(fontBytes);
            const boldFont = await pdfDoc.embedFont(boldFontBytes); // **Use Explicit Bold Font**
    
            const topImageBytes = await fetch('/top.jpg').then(res => res.arrayBuffer());
            const bottomImageBytes = await fetch('/bottom.jpg').then(res => res.arrayBuffer());
    
            const topImage = await pdfDoc.embedJpg(topImageBytes);
            const bottomImage = await pdfDoc.embedJpg(bottomImageBytes);
    
            const pageWidth = 842;
            const pageHeight = 595;
            const marginX = 10;
            const marginY = 5;
    
            const rowHeight = 26;
            const columnWidths = [40, 100, 300, 180, 180];
            const startX = marginX + 10;
    
            const createPage = () => {
                let page = pdfDoc.addPage([pageWidth, pageHeight]);
                page.setFont(font);
                page.setFontSize(9);
    
                // **Draw Header Image (Top)**
                page.drawImage(topImage, {
                    x: marginX,
                    y: pageHeight - marginY - topImage.height,
                    width: 822 - (marginX * 2),
                    height: (822 / topImage.width) * topImage.height
                });
    
                // **Header Text Details (Using Bold Font)**
                page.setFont(boldFont); // **Explicitly Apply Bold Font**
                page.setFontSize(9);
                page.drawText(`CENTER CODE        ${centerCode}`, { x: marginX + 15, y: pageHeight - topImage.height - 15 });
                page.drawText(`${location}`, { x: 400, y: pageHeight - topImage.height - 15 });
                page.drawText(`EXAM DATE  ${examDate || '..................'}`, { x: 650, y: pageHeight - topImage.height - 15 });
    
                // **Center Name (Bold)**
                page.setFont(boldFont);
                page.setFontSize(9);
                page.drawText(`CENTER NAME       ${centerName}`, {
                    x: marginX + 15,
                    y: pageHeight - topImage.height - 30
                });
    
                // **Footer Image (Bottom)**
                const bottomImageWidth = 822 - (marginX * 2);
                const bottomImageHeight = (bottomImageWidth / bottomImage.width) * bottomImage.height;
                const bottomImageX = (pageWidth - bottomImageWidth) / 2;
    
                page.drawImage(bottomImage, {
                    x: bottomImageX,
                    y: marginY + 10,
                    width: bottomImageWidth,
                    height: bottomImageHeight
                });
    
                return page;
            };
    
            let page = createPage();
            let yPosition = pageHeight - topImage.height - 60;
    
            // **Table Headers (Use Bold Font)**
            page.setFont(boldFont); // **Explicitly Set Bold Font**
            page.setFontSize(10);
            const headers = ['NO.', 'ROLL NUMBER', 'STUDENT NAME / FATHER\'S NAME', 'PAPER-I', 'PAPER-II'];
            let currentX = startX;
    
            headers.forEach((text, i) => {
                page.drawText(text, { x: currentX + 5, y: yPosition });
                currentX += columnWidths[i];
            });
    
            page.drawRectangle({
                x: startX,
                y: yPosition - 5,
                width: columnWidths.reduce((a, b) => a + b, 0),
                height: rowHeight,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1
            });
    
            yPosition -= rowHeight;
    
            // **Table Data**
            page.setFont(font); // **Switch Back to Regular Font**
            page.setFontSize(9);
    
            rows.forEach((row, index) => {
                if (yPosition < bottomImage.height + 40) {
                    page = createPage();
                    yPosition = pageHeight - topImage.height - 60;
    
                    // **Redraw Table Headers**
                    page.setFont(boldFont);
                    page.setFontSize(10);
                    currentX = startX;
                    headers.forEach((text, i) => {
                        page.drawText(text, { x: currentX + 5, y: yPosition });
                        currentX += columnWidths[i];
                    });
    
                    page.drawRectangle({
                        x: startX,
                        y: yPosition - 5,
                        width: columnWidths.reduce((a, b) => a + b, 0),
                        height: rowHeight,
                        borderColor: rgb(0, 0, 0),
                        borderWidth: 1
                    });
    
                    yPosition -= rowHeight;
                }
    
                let rowData = [
                    (index + 1).toString(),
                    row['ROLNO']?.toString() || '',
                    row["STUDENT NAME/FATHER'S NAME"]?.toString() || '',
                    'OMR SHEET No. | SIGNATURE',
                    'OMR SHEET No. | SIGNATURE'
                ];
    
                page.setFont(font); // **Ensure Table Data is in Regular Font**
                page.setFontSize(9);
                currentX = startX;
                rowData.forEach((text, i) => {
                    page.drawText(text, { x: currentX + 5, y: yPosition });
                    currentX += columnWidths[i];
                });
    
                page.drawRectangle({
                    x: startX,
                    y: yPosition - 5,
                    width: columnWidths.reduce((a, b) => a + b, 0),
                    height: rowHeight,
                    borderColor: rgb(0, 0, 0),
                    borderWidth: 1
                });
    
                yPosition -= rowHeight;
            });
    
            // **Save PDF and Add to ZIP**
            const pdfBytes = await pdfDoc.save();
            zip.file(`${centerCode}.pdf`, pdfBytes);
        };
    
        const groupedData = data.reduce((acc, row) => {
            const centerCode = row['CENTER CODE'];
            const centerName = row['CENTER NAME'];
            const location = row['DISTRICT NAME'] || '';
            const examDate = row['EXAM DATE'] || '';
    
            if (!acc[centerCode]) acc[centerCode] = { name: centerName, location, examDate, students: [] };
            acc[centerCode].students.push(row);
            return acc;
        }, {});
    
        for (const [centerCode, { name, location, examDate, students }] of Object.entries(groupedData)) {
            await createPDF(centerCode, name, location, examDate, students);
        }
    
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pdfs.zip';
        a.click();
    
        setLoading(false);
        setMessage('✅ PDFs generated successfully!');
    };
    

    return (
        <>
            <NavBar />
            <div className='container mx-auto p-4'>
                <h1 className='text-xl font-bold'>Upload Exam Data CSV/XLSX</h1>
                <input type='file' accept='.csv, .xlsx' onChange={handleFileChange} className='my-4' />
                <button onClick={handleUpload} disabled={loading} className='px-4 py-2 text-white rounded bg-blue-500'>
                    {loading ? 'Processing...' : 'Upload & Generate PDFs'}
                </button>
                <p className='mt-4 text-red-500'>{message}</p>
            </div>
        </>
    );
};

export default Page;