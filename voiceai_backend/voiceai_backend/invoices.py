# Invoice Management for Akashvanni
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Optional, Dict, List
from bson import ObjectId


# Seller details (Akashvanni / TWOZERO)
SELLER = {
    "name": "TWOZERO",
    "gstin": "07ATPPM6940D1ZG",
    "address": "First Floor, A-784, G.D. Colony, Mayur Vihar Phase-3, East Delhi, 110096"
}


class InvoiceDB:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.invoices = db.invoices
        self.counters = db.counters

    async def _next_invoice_number(self) -> str:
        """Auto-increment invoice number like AV-2026-000001"""
        year = datetime.utcnow().year
        counter = await self.counters.find_one_and_update(
            {"_id": f"invoice_{year}"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        seq = counter["seq"]
        return f"AV-{year}-{seq:06d}"

    async def create_invoice(
        self,
        user_id: str,
        transaction_id: str,
        payment_id: str,
        total_amount: float,
        base_amount: float,
        gst_amount: float,
        buyer_name: str,
        buyer_email: str,
        buyer_gstin: str = "",
        buyer_address: str = ""
    ) -> Dict:
        invoice_number = await self._next_invoice_number()
        cgst = round(gst_amount / 2, 2)
        sgst = round(gst_amount - cgst, 2)

        invoice = {
            "invoice_number": invoice_number,
            "user_id": user_id,
            "transaction_id": transaction_id,
            "payment_id": payment_id,
            "total_amount": round(total_amount, 2),
            "base_amount": round(base_amount, 2),
            "gst_amount": round(gst_amount, 2),
            "cgst_amount": cgst,
            "sgst_amount": sgst,
            "seller": SELLER,
            "buyer": {
                "name": buyer_name,
                "email": buyer_email,
                "gstin": buyer_gstin,
                "address": buyer_address
            },
            "created_at": datetime.utcnow()
        }

        invoice["invoice_html"] = generate_invoice_html(invoice)
        result = await self.invoices.insert_one(invoice)
        invoice["_id"] = str(result.inserted_id)
        return invoice

    async def get_invoices_by_user(self, user_id: str, limit: int = 50) -> List[Dict]:
        cursor = self.invoices.find(
            {"user_id": user_id},
            {"invoice_html": 0}  # exclude HTML for list view
        ).sort("created_at", -1).limit(limit)
        invoices = await cursor.to_list(length=limit)
        for inv in invoices:
            inv["_id"] = str(inv["_id"])
            if inv.get("created_at"):
                inv["created_at"] = inv["created_at"].isoformat()
        return invoices

    async def get_invoice_by_id(self, invoice_id: str) -> Optional[Dict]:
        try:
            inv = await self.invoices.find_one({"_id": ObjectId(invoice_id)})
            if inv:
                inv["_id"] = str(inv["_id"])
                if inv.get("created_at"):
                    inv["created_at"] = inv["created_at"].isoformat()
            return inv
        except:
            return None


def generate_invoice_html(invoice: Dict) -> str:
    s = invoice["seller"]
    b = invoice["buyer"]
    dt = invoice.get("created_at", datetime.utcnow())
    if isinstance(dt, str):
        date_str = dt[:10]
    else:
        date_str = dt.strftime("%Y-%m-%d")

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Invoice {invoice['invoice_number']}</title>
<style>
  body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
  .inv {{ max-width: 700px; margin: auto; border: 1px solid #ddd; padding: 32px; }}
  .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; }}
  .title {{ font-size: 28px; font-weight: bold; color: #4f46e5; }}
  .meta {{ text-align: right; font-size: 13px; color: #666; }}
  .parties {{ display: flex; justify-content: space-between; margin-bottom: 24px; }}
  .party {{ width: 48%; }}
  .party h3 {{ font-size: 12px; text-transform: uppercase; color: #999; margin-bottom: 4px; }}
  .party p {{ margin: 2px 0; font-size: 13px; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; }}
  th {{ background: #f3f4f6; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }}
  td {{ padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }}
  .right {{ text-align: right; }}
  .total-row td {{ font-weight: bold; border-top: 2px solid #4f46e5; font-size: 16px; }}
  .footer {{ text-align: center; font-size: 11px; color: #999; margin-top: 24px; }}
</style></head><body>
<div class="inv">
  <div class="header">
    <div>
      <div class="title">Akashvanni</div>
      <div style="font-size:12px;color:#666;">AI Voice Platform</div>
    </div>
    <div class="meta">
      <div><strong>Invoice #:</strong> {invoice['invoice_number']}</div>
      <div><strong>Date:</strong> {date_str}</div>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>From</h3>
      <p><strong>{s['name']}</strong></p>
      <p>GSTIN: {s['gstin']}</p>
      <p>{s['address']}</p>
    </div>
    <div class="party">
      <h3>Bill To</h3>
      <p><strong>{b['name']}</strong></p>
      <p>{b['email']}</p>
      {f"<p>GSTIN: {b['gstin']}</p>" if b.get('gstin') else ""}
      {f"<p>{b['address']}</p>" if b.get('address') else ""}
    </div>
  </div>
  <table>
    <tr><th>Description</th><th class="right">Amount</th></tr>
    <tr><td>Wallet Recharge — Akashvanni AI Voice Platform</td><td class="right">&#8377;{invoice['base_amount']:.2f}</td></tr>
    <tr><td>CGST @ 9%</td><td class="right">&#8377;{invoice['cgst_amount']:.2f}</td></tr>
    <tr><td>SGST @ 9%</td><td class="right">&#8377;{invoice['sgst_amount']:.2f}</td></tr>
    <tr class="total-row"><td>Total</td><td class="right">&#8377;{invoice['total_amount']:.2f}</td></tr>
  </table>
  <p style="font-size:13px;color:#666;">Payment ID: {invoice.get('payment_id','')}</p>
  <div class="footer">This is a computer-generated invoice and does not require a signature.</div>
</div></body></html>"""


# Global instance
_invoice_db: Optional[InvoiceDB] = None


def get_invoice_db() -> InvoiceDB:
    global _invoice_db
    if _invoice_db is None:
        raise RuntimeError("Invoice database not initialized")
    return _invoice_db


def initialize_invoice_db(db: AsyncIOMotorDatabase):
    global _invoice_db
    _invoice_db = InvoiceDB(db)
