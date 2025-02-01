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

                    data.sort((a, b) => a['center'] - b['center']);
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
        const createPDF = async (centerCode, centerName, location, examDate, rows, type) => {
            let pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);

            // **Load Regular and Bold Fonts**
            const fontBytes = await fetch('/NotoSansDevanagari-Regular.ttf').then(res => res.arrayBuffer());
            const boldFontBytes = await fetch('/NotoSansDevanagari-Bold.ttf').then(res => res.arrayBuffer());

            const font = await pdfDoc.embedFont(fontBytes);
            const boldFont = await pdfDoc.embedFont(boldFontBytes);

            const topImageBytes = await fetch('/topbg.jpg').then(res => res.arrayBuffer());
            const bottomImageBytes = await fetch('/bottom1.jpg').then(res => res.arrayBuffer());
            const mukhyaKenraImage = await fetch('/mmm.jpg').then(res => res.arrayBuffer());
            const uppkendraImage = await fetch('/uu.jpg').then(res => res.arrayBuffer());
            const fallbackBytes = await fetch('/fallback.jpg').then(res => res.arrayBuffer());


            const topImage = await pdfDoc.embedJpg(topImageBytes);
            const bottomImage = await pdfDoc.embedJpg(bottomImageBytes);

            const mainImage = await pdfDoc.embedJpg(mukhyaKenraImage);
            const uppImage = await pdfDoc.embedJpg(uppkendraImage);

            const fallbackImage = await pdfDoc.embedJpg(fallbackBytes);


            const pageWidth = 842;  // A4 height becomes width
            const pageHeight = 695;
            const marginX = 10;
            const marginY = 0;

            const rowHeight = 37;
            const headerHeight = 40;
            const columnWidths = [35, 90, 260, 80, 130, 80, 130];
            const startX = marginX + 10;
            let currentX = startX;

            const createPage = () => {
                let page = pdfDoc.addPage([pageWidth, pageHeight]);
                page.setFont(font);
                page.setFontSize(9);

                const topImageWidth = 785 - (marginX * 2);
                const topImageHeight = (822 / topImage.width) * topImage.height;
                page.drawImage(topImage, {
                    x: marginX,
                    y: pageHeight - marginY - topImage.height + 100,
                    width: topImageWidth,
                    height: topImageHeight
                });

                // **Calculate Remaining Width**
                const remainingWidth = pageWidth - (marginX + topImageWidth + 20);
                const textX = marginX + topImageWidth + (remainingWidth / 2);

                // **Set Bold Font & Large Font Size**
                page.setFont(boldFont); // Ensure you have a bold font loaded
                page.setFontSize(16); // Increase font size

                // मुख्य केंद्र    उप केंद्र
                const selectedImage = type
                    ? type === 'मुख्य केंद्र'
                        ? mainImage
                        : uppImage
                    : fallbackImage;


                // **Draw Bold & Large Text**
                page.drawImage(selectedImage, {
                    x: textX - 60,
                    y: pageHeight - marginY - topImageHeight + 10, // Align vertically with the top image
                    width: remainingWidth + 10, // Ensure text stays within the remaining space
                    height: remainingWidth + 10
                });

                // **Header Text Details (Using Bold Font)**
                page.setFont(boldFont);
                page.setFontSize(9);
                page.drawText(`CENTER CODE        ${centerCode}`, { x: marginX + 15, y: pageHeight - topImage.height + 80 });
                page.drawText(`${location}`, { x: 440, y: pageHeight - topImage.height + 80 });
                page.drawText(`EXAM DATE  ${examDate || '.................................'}`, { x: 650, y: pageHeight - topImage.height + 80 });

                // **Center Name**
                page.drawText(`CENTER NAME       ${centerName}`, {
                    x: marginX + 15,
                    y: pageHeight - topImage.height + 60
                });

                // **Footer Image (Bottom)**
                const bottomImageWidth = 822 - (marginX * 2);
                const bottomImageHeight = (bottomImageWidth / bottomImage.width) * bottomImage.height;
                const bottomImageX = (pageWidth - bottomImageWidth) / 2;

                page.drawImage(bottomImage, {
                    x: bottomImageX,
                    y: marginY,
                    width: bottomImageWidth,
                    height: bottomImageHeight
                });

                return page;
            };

            let page = createPage();
            let yPosition = pageHeight - topImage.height + 40;
            const drawTableHeader = () => {
                // **Table Headers (Using Multi-Row Headers)**
                page.setFont(boldFont);
                page.setFontSize(10);
                const headers =
                    ['NO.', 'ROLL NUMBER', 'STUDENT NAME / FATHER\'S NAME', 'PAPER - I (01:00 PM 02:30 PM)', '', 'PAPER - II (01:00 PM 02:30 PM)', ''];
                const subHeaders =
                    ['', '', '', 'OMR SHEET No.', 'SIGNATURE OF CANDIDATE', 'OMR SHEET No.', 'SIGNATURE OF CANDIDATE'];

                // **First Row of Headers**
                headers.forEach((text, i) => {
                    if (text === 'PAPER - I (01:00 PM 02:30 PM)' || text === 'PAPER - II (01:00 PM 02:30 PM)') {
                        page.drawText(text, { x: currentX + 15, y: yPosition - 13 });

                        if (text === "PAPER - I (01:00 PM 02:30 PM)") {
                            // ✅ Draw only Top, Left, Bottom (Hide Right Border)
                            page.drawLine({
                                start: { x: currentX, y: yPosition }, // Top-left
                                end: { x: currentX + columnWidths[i] + columnWidths[i + 1], y: yPosition }, // Top-right
                                thickness: 0.5,
                                color: rgb(0, 0, 0)
                            });

                            page.drawLine({
                                start: { x: currentX, y: yPosition }, // Top-left
                                end: { x: currentX, y: yPosition - headerHeight }, // Bottom-left
                                thickness: 0.5,
                                color: rgb(0, 0, 0)
                            });

                            page.drawLine({
                                start: { x: currentX, y: yPosition - headerHeight }, // Bottom-left
                                end: { x: currentX + columnWidths[i] + columnWidths[i + 1], y: yPosition - headerHeight }, // Bottom-right
                                thickness: 0.5,
                                color: rgb(0, 0, 0)
                            });

                        } else {
                            // ✅ Draw only Top, Right, Bottom (Hide Left Border)
                            page.drawLine({
                                start: { x: currentX, y: yPosition }, // Top-left
                                end: { x: currentX + columnWidths[i] + columnWidths[i + 1], y: yPosition }, // Top-right
                                thickness: 0.5,
                                color: rgb(0, 0, 0)
                            });

                            page.drawLine({
                                start: { x: currentX + columnWidths[i] + columnWidths[i + 1], y: yPosition }, // Top-right
                                end: { x: currentX + columnWidths[i] + columnWidths[i + 1], y: yPosition - headerHeight }, // Bottom-right
                                thickness: 0.5,
                                color: rgb(0, 0, 0)
                            });

                            page.drawLine({
                                start: { x: currentX, y: yPosition - headerHeight }, // Bottom-left
                                end: { x: currentX + columnWidths[i] + columnWidths[i + 1], y: yPosition - headerHeight }, // Bottom-right
                                thickness: 0.5,
                                color: rgb(0, 0, 0)
                            });
                        }

                        page.drawRectangle({
                            x: currentX,
                            y: yPosition - headerHeight,
                            width: columnWidths[i] + columnWidths[i + 1], // Merge 2 columns
                            height: headerHeight,
                            borderColor: rgb(0, 0, 0),
                            borderWidth: 0.5
                        });
                    } else if (text !== '') {
                        page.drawText(text, { x: currentX + 15, y: yPosition - 25 });
                        page.drawRectangle({
                            x: currentX,
                            y: yPosition - headerHeight,
                            width: columnWidths[i],
                            height: headerHeight,
                            borderColor: rgb(0, 0, 0),
                            borderWidth: 0.5
                        });
                    }
                    currentX += columnWidths[i];
                });

                yPosition -= headerHeight / 2;

                // **Second Row of Headers**
                currentX = startX;
                subHeaders.forEach((text, i) => {
                    if (text !== '') {
                        page.setFontSize(8);
                        page.drawText(text, { x: currentX + 5, y: yPosition - 12 });

                        page.drawRectangle({
                            x: currentX,
                            y: yPosition - headerHeight / 2,
                            width: columnWidths[i],
                            height: headerHeight / 2,
                            borderColor: rgb(0, 0, 0),
                            borderWidth: 0.5
                        });
                    }
                    currentX += columnWidths[i];
                });

                yPosition -= headerHeight / 2;
            };


            // **Table Data**
            page.setFont(font);
            page.setFontSize(9);
            drawTableHeader();
            let extraRow = ['', '', '', '', '', '', ''];
            currentX = startX;
            page.setFont(font);
            page.setFontSize(9);

            extraRow.forEach((text, i) => {
                page.drawText(text, { x: currentX + 5, y: yPosition });
                currentX += columnWidths[i];
            });

            // ✅ Adjust `yPosition` after adding the extra row
            yPosition -= rowHeight - 5;
            rows.forEach((row, index) => {
                if (index === 0) {
                    if (yPosition < bottomImage.height - 150) {
                        page = createPage();
                        yPosition = pageHeight - topImage.height;
                        page.setFont(boldFont);
                        page.setFontSize(10);
                        currentX = startX;
                        yPosition -= rowHeight;
                    }

                    let rowData = [
                        (index + 1).toString(),
                        row['rollno']?.toString() || '',
                        row["student"]?.toString() || '',
                        '',
                        '',
                        '',
                        ''
                    ];

                    page.setFont(font);
                    page.setFontSize(9);
                    currentX = startX;
                    rowData.forEach((text, i) => {
                        if (true) {
                            if (text.length > 28 && i === 2) {
                                let words = text.split(' ');
                                let lines = [];
                                let currentLine = '';

                                for (let word of words) {
                                    if ((currentLine + ' ' + word).trim().length <= 35) {
                                        currentLine += (currentLine ? ' ' : '') + word;
                                    } else {
                                        lines.push(currentLine);
                                        currentLine = word;
                                    }
                                }
                                if (currentLine) {
                                    lines.push(currentLine);
                                }
                                const tempY = yPosition + 22;
                                for (let j = 0; j < lines.length; j++) {

                                    page.drawText(lines[j], { x: currentX + 5, y: tempY - (j * 12) });
                                }

                                page.drawRectangle({
                                    x: currentX,
                                    y: yPosition - Math.sqrt(rowHeight),
                                    width: columnWidths[i],
                                    height: rowHeight,
                                    borderColor: rgb(0, 0, 0),
                                    borderWidth: 0.5
                                });

                                currentX += columnWidths[i];
                            } else {
                                page.drawText(text, { x: currentX + 5, y: yPosition + 10 });
                                page.drawRectangle({
                                    x: currentX,
                                    y: yPosition - Math.sqrt(rowHeight),
                                    width: columnWidths[i],
                                    height: rowHeight,
                                    borderColor: rgb(0, 0, 0),
                                    borderWidth: 0.5
                                });
                                currentX += columnWidths[i];
                            }
                        }

                    });

                    yPosition -= rowHeight;
                } else {

                    if (yPosition < bottomImage.height - 50) {
                        page = createPage();
                        yPosition = pageHeight - topImage.height + 40;
                        // **Redraw Table Headers**
                        page.setFont(boldFont);
                        page.setFontSize(10);
                        currentX = startX;
                        drawTableHeader();
                        yPosition -= rowHeight - 5;
                    }

                    let rowData = [
                        (index + 1).toString(),
                        row['rollno']?.toString() || '',
                        row["student"]?.toString() || '',
                        '',
                        '',
                        '',
                        ''
                    ];

                    page.setFont(font);
                    page.setFontSize(9);
                    currentX = startX;
                    // rowData.forEach((text, i) => {


                    //     page.drawText(text, { x: currentX + 5, y: yPosition });
                    //     page.drawRectangle({
                    //         x: currentX,
                    //         y: yPosition - Math.sqrt(rowHeight),
                    //         width: columnWidths[i],
                    //         height: rowHeight,
                    //         borderColor: rgb(0, 0, 0),
                    //         borderWidth: 0.5
                    //     });
                    //     currentX += columnWidths[i];
                    // });
                    rowData.forEach((text, i) => {
                        if (true) {
                            if (text.length > 28 && i === 2) {
                                let words = text.split(' ');
                                let lines = [];
                                let currentLine = '';

                                for (let word of words) {
                                    if ((currentLine + ' ' + word).trim().length <= 35) {
                                        currentLine += (currentLine ? ' ' : '') + word;
                                    } else {
                                        lines.push(currentLine);
                                        currentLine = word;
                                    }
                                }
                                if (currentLine) {
                                    lines.push(currentLine);
                                }
                                const tempY = yPosition + 22;
                                for (let j = 0; j < lines.length; j++) {

                                    page.drawText(lines[j], { x: currentX + 5, y: tempY - (j * 12) });
                                }

                                page.drawRectangle({
                                    x: currentX,
                                    y: yPosition - Math.sqrt(rowHeight),
                                    width: columnWidths[i],
                                    height: rowHeight,
                                    borderColor: rgb(0, 0, 0),
                                    borderWidth: 0.5
                                });

                                currentX += columnWidths[i];
                            } else {
                                page.drawText(text, { x: currentX + 5, y: yPosition + 10 });
                                page.drawRectangle({
                                    x: currentX,
                                    y: yPosition - Math.sqrt(rowHeight),
                                    width: columnWidths[i],
                                    height: rowHeight,
                                    borderColor: rgb(0, 0, 0),
                                    borderWidth: 0.5
                                });
                                currentX += columnWidths[i];
                            }
                        }

                    });
                    yPosition -= rowHeight;
                }
            });

            // **Save PDF and Add to ZIP**

            const pdfBytes = await pdfDoc.save();
            zip.file(`${centerCode}.pdf`, pdfBytes);
        };

        const groupedData = data.reduce((acc, row) => {
            const centerCode = row['center'];
            const centerName = row['cennm'];
            const location = row['dstnm'] || '';
            const examDate = row['EXAM DATE'] || '';
            const type = row['TYPE'];
            if (!acc[centerCode]) acc[centerCode] = { name: centerName, location, examDate, type, students: [] };
            acc[centerCode].students.push(row);
            return acc;
        }, {});


        // Add 10 empty data objects for each group
        Object.keys(groupedData).forEach(centerCode => {
            for (let i = 0; i < 10; i++) {
                groupedData[centerCode].students.push({ isEmpty: true }); // Empty object with a flag
            }
        });
        for (const [centerCode, { name, location, examDate, students, type }] of Object.entries(groupedData)) {
            await createPDF(centerCode, name, location, examDate, students, type);
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