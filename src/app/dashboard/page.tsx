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

    const generatePDFs = async (data: any[]) => {
        setMessage('⏳ Generating PDFs...');
        const zip = new JSZip();

        const createPDF = async (centerCode, centerName, location, examDate, rows) => {
            let pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
        
            const fontBytes = await fetch('/NotoSansDevanagari-Regular.ttf').then(res => res.arrayBuffer());
            const font = await pdfDoc.embedFont(fontBytes);
        
            const topImageBytes = await fetch('/top.jpg').then(res => res.arrayBuffer());
            const bottomImageBytes = await fetch('/bottom.jpg').then(res => res.arrayBuffer());
        
            const topImage = await pdfDoc.embedJpg(topImageBytes);
            const bottomImage = await pdfDoc.embedJpg(bottomImageBytes);
        
            const createPage = () => {
                let page = pdfDoc.addPage([842, 595]);   
                page.setFont(font);
                page.setFontSize(12);
        
                const pageWidth = 842; // Standard page width
        
                // Draw header image (TOP)
                page.drawImage(topImage, {
                    x: 20,
                    y: 595 - topImage.height,
                    width: 802,  // Full width
                    height: (802 / topImage.width) * topImage.height // Maintain aspect ratio
                });
        
                // Center Code, Location, Exam Date
                page.setFontSize(11);
                page.drawText(`CENTER CODE  ${centerCode}`, { x: 50, y: 595 - topImage.height - 20, font });
                page.drawText(`${location}`, { x: 400, y: 595 - topImage.height - 20, font });
                page.drawText(`EXAM DATE  ${examDate || '..................'}`, { x: 600, y: 595 - topImage.height - 20, font });
        
                // Center Name
                page.setFontSize(11);
                page.drawText(`CENTER NAME  ${centerName}`, {
                    x: 50,
                    y: 595 - topImage.height - 40,
                    font,
                    color: rgb(0, 0, 0)
                });
        
                // **Draw footer image (BOTTOM) - Same size as the top image**
                const bottomImageWidth = 802; // Match top image width
                const bottomImageHeight = (bottomImageWidth / bottomImage.width) * bottomImage.height; // Maintain aspect ratio
                const bottomImageX = (pageWidth - bottomImageWidth) / 2; // Center align
        
                page.drawImage(bottomImage, {
                    x: bottomImageX,
                    y: 20,  // Placed at the bottom
                    width: bottomImageWidth,
                    height: bottomImageHeight
                });
        
                return page;
            };
        
            let page = createPage();
            let yPosition = 595 - topImage.height - 80;
            let rowHeight = 30;
        
            const columnWidths = [40, 100, 250, 150, 150];
            const startX = 40;
        
            // Table Header
            const headers = ['NO.', 'ROLL NUMBER', 'STUDENT NAME / FATHER\'S NAME', 'PAPER-I', 'PAPER-II'];
            let currentX = startX;
            page.setFontSize(11);
            headers.forEach((text, i) => {
                page.drawText(text, { x: currentX, y: yPosition, size: 11, font, bold: true });
                currentX += columnWidths[i];
            });
        
            // Draw header border
            page.drawRectangle({
                x: startX,
                y: yPosition - 5,
                width: columnWidths.reduce((a, b) => a + b, 0),
                height: rowHeight,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1
            });
        
            yPosition -= rowHeight;
            page.setFontSize(10);
        
            // Draw student data with table borders
            rows.forEach((row, index) => {
                if (yPosition < 100) {
                    page = createPage();
                    yPosition = 595 - topImage.height - 100;
        
                    // Redraw table headers on new page
                    currentX = startX;
                    headers.forEach((text, i) => {
                        page.drawText(text, { x: currentX, y: yPosition, size: 11, font, bold: true });
                        currentX += columnWidths[i];
                    });
        
                    // Draw header border
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
        
                currentX = startX;
                rowData.forEach((text, i) => {
                    page.drawText(text, { x: currentX, y: yPosition, size: 10, font });
                    currentX += columnWidths[i];
                });
        
                // Draw row border
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
        
            // Save PDF and add to zip
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
