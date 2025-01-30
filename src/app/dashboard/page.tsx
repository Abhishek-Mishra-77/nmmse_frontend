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
        // Remove Zero Width Space (0x200b) and other non-encodable characters
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
                        // If it's a CSV file, use utils to read it
                        const csvData = new TextDecoder().decode(fileData);
                        data = utils.csv_to_sheet(csvData);
                    } else {
                        // If it's an XLSX file, use SheetJS to parse it
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

    // const generatePDFs = async (data: any[]) => {
    //     setMessage('⏳ Generating PDFs...');
    //     const zip = new JSZip();
    //     let pdfDoc = await PDFDocument.create();
    //     let page: any = null;
    //     let font: any = null;

    //     // Register fontkit with pdf-lib
    //     pdfDoc.registerFontkit(fontkit);

    //     // Load font for text (you can adjust this to use a custom font if needed)
    //     const fontBytes = await fetch('/NotoSansDevanagari-Regular.ttf').then(res => res.arrayBuffer());
    //     font = await pdfDoc.embedFont(fontBytes); // Embed font after creating pdfDoc

    //     // Function to create a new page
    //     const createPage = async () => {
    //         page = pdfDoc.addPage([600, 850]); // Adjust page size as needed
    //         page.setFont(font);
    //         page.setFontSize(10);
    //     };

    //     // Group data by CENTER CODE
    //     const groupedData = data.reduce((acc, row) => {
    //         const centerCode = row['CENTER CODE'];
    //         if (!acc[centerCode]) acc[centerCode] = [];
    //         acc[centerCode].push(row);
    //         return acc;
    //     }, {} as Record<string, any[]>);

    //     // Iterate over each center group and generate PDFs
    //     for (const [centerCode, rows] of Object.entries(groupedData)) {
    //         await createPage(); // Initialize a new page for each center code

    //         // Add header and static text (adjust positions as needed)
    //         page.drawText('छत्तीसगढ़ माध्यमिक शिक्षा मण्डल, रायपुर द्वारा आयोजित', { x: 50, y: 800, size: 12 });
    //         page.drawText('राष्ट्रीय साधन सह-प्रावीण्य छात्रवृत्ति (NMMSE) परीक्षा - 2024-25', { x: 50, y: 780, size: 12 });
    //         page.drawText('मुख्य केंद्र', { x: 50, y: 760, size: 12 });

    //         page.drawText('SIGNATURE ROLL', { x: 50, y: 740, size: 12 });
    //         page.drawText(`CENTER CODE: ${centerCode}`, { x: 50, y: 720, size: 12 });
    //         page.drawText('EXAM DATE: ..........', { x: 50, y: 700, size: 12 });

    //         // Add table headers for student data
    //         page.drawText('NO.', { x: 50, y: 680, size: 10 });
    //         page.drawText('ROLL NUMBER', { x: 100, y: 680, size: 10 });
    //         page.drawText('STUDENT NAME/FATHER\'S NAME', { x: 200, y: 680, size: 10 });
    //         page.drawText('PAPER-I', { x: 400, y: 680, size: 10 });
    //         page.drawText('PAPER-II', { x: 500, y: 680, size: 10 });

    //         let yPosition = 660;

    //         // Add student data
    //         for (const row of rows) {
    //             if (yPosition < 60) {
    //                 page = pdfDoc.addPage([600, 850]); // Add new page if space runs out
    //                 yPosition = 800; // Reset position for new page
    //             }

    //             page.drawText(removeUnsupportedCharacters(row['NO.']?.toString() || ''), { x: 50, y: yPosition, size: 10 });
    //             page.drawText(removeUnsupportedCharacters(row['ROLNO']?.toString() || ''), { x: 100, y: yPosition, size: 10 });
    //             page.drawText(removeUnsupportedCharacters(row['STUDENT NAME/FATHER\'S NAME']?.toString() || ''), { x: 200, y: yPosition, size: 10 });
    //             page.drawText('OMR SHEET No.|SIGNATURE', { x: 400, y: yPosition, size: 10 });
    //             page.drawText('OMR SHEET No.|SIGNATURE', { x: 500, y: yPosition, size: 10 });

    //             yPosition -= 20; // Move to the next row
    //         }

    //         // Add signature and footer
    //         page.drawText('SIGNATURE ROOM SUPERVISOR', { x: 50, y: yPosition - 40, size: 10 });
    //         page.drawText('SIGNATURE EXAM INCHARGE', { x: 200, y: yPosition - 40, size: 10 });
    //         page.drawText('SIGNATURE EXAM SUPRITENDENT', { x: 400, y: yPosition - 40, size: 10 });

    //         // Save PDF and add to zip
    //         const pdfBytes = await pdfDoc.save();
    //         zip.file(`${centerCode}.pdf`, pdfBytes);
    //     }

    //     // Create ZIP file
    //     const zipBlob = await zip.generateAsync({ type: 'blob' });
    //     const url = window.URL.createObjectURL(zipBlob);

    //     // Trigger download
    //     const a = document.createElement('a');
    //     a.href = url;
    //     a.download = 'pdfs.zip';
    //     a.click();

    //     setLoading(false);
    //     setMessage('✅ PDFs generated successfully!');
    // };


    const generatePDFs = async (data: any[]) => {
        setMessage('⏳ Generating PDFs...');
        const zip = new JSZip();

        // Function to create a new PDF document
        const createPDF = async (centerCode: string, centerName: string, rows: any[]) => {
            let pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);

            // Load font
            const fontBytes = await fetch('/NotoSansDevanagari-Regular.ttf').then(res => res.arrayBuffer());
            const font = await pdfDoc.embedFont(fontBytes);

            // Load logo image
            const logoBytes = await fetch('/nmmselogo.png').then(res => res.arrayBuffer());
            const logoImage = await pdfDoc.embedPng(logoBytes);

            // Function to create a new page
            const createPage = () => {
                let page = pdfDoc.addPage([600, 850]); // Page size
                page.setFont(font);
                page.setFontSize(10);
                return page;
            };

            let page = createPage();

            // Function to draw the header
            const drawHeader = () => {
                page.drawImage(logoImage, { x: 30, y: 780, width: 60, height: 60 });

                // Title & Symbols

                page.drawText('छत्तीसगढ़ माध्यमिक शिक्षा मण्डल, रायपुर द्वारा आयोजित', { x: 100, y: 800, size: 12 });
                page.drawText('राष्ट्रीय साधन सह-प्रावीण्य छात्रवृत्ति (NMMSE) परीक्षा - 2024-25', { x: 100, y: 780, size: 12 });
                page.drawText('मुख्य केंद्र', { x: 260, y: 760, size: 12 });

                page.drawText('SIGNATURE ROLL', { x: 230, y: 740, size: 12 });

                page.drawText(`CENTER CODE: ${centerCode}`, { x: 50, y: 720, size: 12 });
                page.drawText(`DHAMTARI`, { x: 230, y: 720, size: 12 });
                page.drawText('EXAM DATE: ......................', { x: 400, y: 720, size: 12 });

                page.drawText(`CENTER NAME: ${centerName}`, { x: 50, y: 700, size: 12 });
            };

            // Function to draw the table
            const drawTable = (yPosition: number, rows: any[]) => {
                const columnPositions = [50, 100, 200, 400, 500]; // Adjust column positions
                const rowHeight = 25;

                // Draw header row
                const headers = [
                    'NO.', 'ROLL NUMBER', 'STUDENT NAME/FATHER\'S NAME',
                    'PAPER-I (10:00 AM-11:30 AM)', 'PAPER-II (01:00 PM-02:30 PM)'
                ];
                headers.forEach((text, i) => {
                    page.drawText(text, { x: columnPositions[i], y: yPosition, size: 10 });
                });

                // Draw header borders
                page.drawRectangle({
                    x: 50,
                    y: yPosition - 5,
                    width: 500,
                    height: rowHeight,
                    borderColor: rgb(0, 0, 0),
                    borderWidth: 1,
                });

                yPosition -= rowHeight;

                // Draw student data rows
                rows.forEach((row, index) => {
                    const rowData = [
                        (index + 1).toString(),
                        row['ROLNO']?.toString() || '',
                        row['STUDENT NAME/FATHER\'S NAME']?.toString() || '',
                        'OMR SHEET No. | SIGNATURE OF CANDIDATE',
                        'OMR SHEET No. | SIGNATURE OF CANDIDATE',
                    ];

                    rowData.forEach((text, i) => {
                        page.drawText(text, { x: columnPositions[i], y: yPosition, size: 10 });
                    });

                    // Draw table row borders
                    page.drawRectangle({
                        x: 50,
                        y: yPosition - 5,
                        width: 500,
                        height: rowHeight,
                        borderColor: rgb(0, 0, 0),
                        borderWidth: 1,
                    });

                    yPosition -= rowHeight;
                });

                return yPosition;
            };

            // Generate PDF pages with 10 rows per page
            for (let i = 0; i < rows.length; i += 10) {
                if (i > 0) page = createPage(); // New page for every 10 students
                drawHeader();
                let yPosition = 660;
                yPosition = drawTable(yPosition, rows.slice(i, i + 10));

                // Add signature section
                page.drawText('SIGNATURE', { x: 50, y: yPosition - 40, size: 10 });
                page.drawText('SIGNATURE', { x: 230, y: yPosition - 40, size: 10 });
                page.drawText('SIGNATURE SEAL', { x: 400, y: yPosition - 40, size: 10 });

                page.drawText('ROOM SUPERVISOR', { x: 50, y: yPosition - 60, size: 10 });
                page.drawText('EXAM INCHARGE', { x: 230, y: yPosition - 60, size: 10 });
                page.drawText('EXAM SUPRITENDENT', { x: 400, y: yPosition - 60, size: 10 });
            }

            // Save PDF and add to zip
            const pdfBytes = await pdfDoc.save();
            zip.file(`${centerCode}.pdf`, pdfBytes);
        };

        // Group data by CENTER CODE and generate PDFs
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

        // Create ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(zipBlob);

        // Trigger download
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
                <button
                    onClick={handleUpload}
                    className={`px-4 py-2 text-white rounded ${loading ? 'bg-gray-400' : 'bg-blue-500'}`}
                    disabled={loading}
                >
                    {loading ? 'Processing...' : 'Upload & Generate PDFs'}
                </button>
                <p className='mt-4 text-red-500'>{message}</p>
            </div>
        </>
    );
};

export default Page;
