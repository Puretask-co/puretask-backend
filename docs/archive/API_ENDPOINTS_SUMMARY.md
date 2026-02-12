# API Endpoints Summary - Newly Created

## ✅ **Client Routes** (`/client/*`)

### **Favorites**
- `GET /client/favorites` - Get all favorite cleaners
- `POST /client/favorites` - Add cleaner to favorites
- `DELETE /client/favorites/:id` - Remove favorite

### **Addresses**
- `GET /client/addresses` - Get all addresses
- `POST /client/addresses` - Add new address
- `PATCH /client/addresses/:id` - Update address
- `PATCH /client/addresses/:id/default` - Set default address
- `DELETE /client/addresses/:id` - Delete address

### **Payment Methods**
- `GET /client/payment-methods` - Get payment methods (Stripe integration pending)
- `PATCH /client/payment-methods/:id/default` - Set default payment method (Stripe integration pending)
- `DELETE /client/payment-methods/:id` - Delete payment method (Stripe integration pending)

### **Recurring Bookings**
- `GET /client/recurring-bookings` - Get all recurring bookings
- `POST /client/recurring-bookings` - Create recurring booking
- `PATCH /client/recurring-bookings/:id` - Update recurring booking
- `DELETE /client/recurring-bookings/:id` - Cancel recurring booking

### **Reviews**
- `GET /client/reviews/given` - Get reviews given by client
- `POST /client/reviews` - Create a review
- `PATCH /client/reviews/:id` - Update a review
- `DELETE /client/reviews/:id` - Delete a review

---

## 📝 **Notes**

### **Payment Methods**
Payment methods are stored in Stripe, not in our database. The endpoints are created but need Stripe API integration:
- Currently returns empty array or placeholder
- To complete: Integrate Stripe SDK to list/update/delete payment methods
- Database only stores `default_payment_method_id` in `stripe_customers` table

### **Frontend Updates**
All frontend services have been updated to use the correct API paths:
- ✅ Favorites service: `/client/favorites`
- ✅ Recurring bookings: `/client/recurring-bookings`
- ✅ Reviews: `/client/reviews/*`
- ✅ Addresses: `/client/addresses`
- ✅ Payment methods: `/client/payment-methods`

---

## 🔧 **Next Steps**

1. **Stripe Integration**: Complete payment methods endpoints with Stripe API calls
2. **Testing**: Test all endpoints with real data
3. **Error Handling**: Add more robust error handling
4. **Validation**: Add more input validation where needed
5. **Documentation**: Add API documentation (Swagger/OpenAPI)

---

## ✅ **Status**

- ✅ All endpoints created
- ✅ Frontend services updated
- ✅ Routes mounted in `src/index.ts`
- ⏳ Stripe payment methods integration pending
- ✅ All other endpoints ready for testing
