import CloudmersiveBarcodeapiClient from 'cloudmersive-barcodeapi-client';

/**
 * Helper to get configured Cloudmersive APIs.
 * This ensures they use the latest CLOUDMERSIVE_API_KEY from process.env.
 */
const getApis = () => {
    const defaultClient = CloudmersiveBarcodeapiClient.ApiClient.instance;
    const Apikey = defaultClient.authentications['Apikey'];
    Apikey.apiKey = process.env.CLOUDMERSIVE_API_KEY;

    return {
        barcodeApi: new CloudmersiveBarcodeapiClient.BarcodeScanApi(),
        lookupApi: new CloudmersiveBarcodeapiClient.BarcodeLookupApi()
    };
};

/**
 * POST /api/ocr/scan
 * Scans an image file (from memory buffer) for barcodes.
 */
export const scanBarcode = async (req, res) => {
    try {
        console.log('--- OCR Scan Request ---');
        console.log('File:', req.file ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : 'MISSING');
        console.log('Body:', req.body);

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ ok: false, message: 'No image file provided' });
        }

        const { barcodeApi } = getApis();

        barcodeApi.barcodeScanImage(req.file.buffer, (error, data) => {
            if (error) {
                console.error('Cloudmersive Scan Error:', error);
                return res.status(500).json({ ok: false, message: 'Error scanning barcode' });
            }

            if (data && data.Successful) {
                console.log('Barcode detected:', data.RawText, '(', data.BarcodeType, ')');
                return res.status(200).json({
                    ok: true,
                    text: data.RawText,
                    type: data.BarcodeType
                });
            }

            return res.status(404).json({ ok: false, message: 'No barcode detected in image' });
        });
    } catch (err) {
        console.error('scanBarcode controller error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * POST /api/ocr/lookup
 * Looks up product info by EAN/ISBN.
 */
export const lookupBarcode = async (req, res) => {
    try {
        const { value } = req.body;
        if (!value) return res.status(400).json({ ok: false, message: 'Barcode value is required' });

        const { lookupApi } = getApis();

        lookupApi.barcodeLookupEanLookup(value, (error, data) => {
            if (error) {
                console.error('Cloudmersive Lookup Error:', error);
                return res.status(500).json({ ok: false, message: 'Error looking up barcode' });
            }

            if (data && data.Successful) {
                return res.status(200).json({
                    ok: true,
                    matches: data.Matches
                });
            }

            return res.status(404).json({ ok: false, message: 'Product not found for this barcode' });
        });
    } catch (err) {
        console.error('lookupBarcode controller error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};
