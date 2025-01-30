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

    const removeUnsupportedCharacters = (text: string) => {
        return text.replace(/\u200B/g, '');
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
    
        const createPDF = async (centerCode: string, centerName: string, rows: any[]) => {
            let pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
    
            // Load fonts
            const fontBytes = await fetch('/NotoSansDevanagari-Regular.ttf').then(res => res.arrayBuffer());
            const font = await pdfDoc.embedFont(fontBytes);
    
            // Load images
            const topImageBytes = await fetch('/top.jpg').then(res => res.arrayBuffer());
            const bottomImageBytes = await fetch('/bottom.jpg').then(res => res.arrayBuffer());
    
            const topImage = await pdfDoc.embedJpg(topImageBytes);
            const bottomImage = await pdfDoc.embedJpg(bottomImageBytes);
    
            // Function to create a new page
            const createPage = () => {
                let page = pdfDoc.addPage([842, 595]); // A4 landscape (width x height)
                page.setFont(font);
                page.setFontSize(10);
                return page;
            };
    
            let page = createPage();
    
            // Draw header image (50px from top, 20px left/right margin)
            page.drawImage(topImage, {
                x: 20,
                y: 595 - 50 - topImage.height,
                width: 802, // 20px margin on each side
                height: (802 / topImage.width) * topImage.height
            });
    
            // Table positioning
            let tableStartY = 400; // Adjusted based on image layout
            let rowHeight = 25;
            const columnWidths = [40, 80, 200, 100, 100]; // Column widths for NO., Roll No., Name, Paper-I, Paper-II
            const startX = 40; // Starting X position
    
            // Draw table header
            const headers = ['NO.', 'ROLL NUMBER', 'STUDENT NAME / FATHER\'S NAME', 'PAPER-I (10:00 AM - 11:30 AM)', 'PAPER-II (01:00 PM - 02:30 PM)'];
            let currentX = startX;
            page.setFontSize(10);
    
            headers.forEach((text, i) => {
                page.drawText(text, { x: currentX, y: tableStartY, size: 10 });
                currentX += columnWidths[i];
            });
    
            // Draw student data
            let yPosition = tableStartY - rowHeight;
            page.setFontSize(9);
    
            rows.forEach((row, index) => {
                if (yPosition < 100) {
                    page = createPage();
                    yPosition = tableStartY;
                }
    
                let rowData = [
                    (index + 1).toString(),
                    row['ROLNO']?.toString() || '',
                    row['STUDENT NAME/FATHER\'S NAME']?.toString() || '',
                    'OMR SHEET No. | SIGNATURE',
                    'OMR SHEET No. | SIGNATURE'
                ];
    
                currentX = startX;
                rowData.forEach((text, i) => {
                    page.drawText(text, { x: currentX, y: yPosition, size: 9 });
                    currentX += columnWidths[i];
                });
    
                yPosition -= rowHeight;
            });
    
            // Draw footer image (50px from bottom, 20px left/right margin)
            page.drawImage(bottomImage, {
                x: 20,
                y: yPosition - 50 - bottomImage.height,
                width: 802,
                height: (802 / bottomImage.width) * bottomImage.height
            });
    
            // Save PDF and add to zip
            const pdfBytes = await pdfDoc.save();
            zip.file(`${centerCode}.pdf`, pdfBytes);
        };
    
        // Process data and generate PDFs
        const groupedData = data.reduce((acc, row) => {
            const centerCode = row['CENTER CODE'];
            const centerName = row['CENTER NAME'];
            if (!acc[centerCode]) acc[centerCode] = { name: centerName, students: [] };
            acc[centerCode].students.push(row);
            return acc;
        }, {} as Record<string, { name: string; students: any[] }>);
    
        for (const [centerCode, { name, students }] of Object.entries(groupedData)) {
            await createPDF(centerCode, name, students);
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
