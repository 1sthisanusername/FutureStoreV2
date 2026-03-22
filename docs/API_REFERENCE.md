# Future Store API Reference

Base URL: `http://localhost:5000/api`
Auth: `Authorization: Bearer <token>`

## Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /auth/captcha | — | Get CAPTCHA SVG |
| POST | /auth/register | — | Register new user |
| POST | /auth/login | — | Login |
| POST | /auth/logout | ✅ | Logout |
| POST | /auth/refresh | — | Refresh JWT |
| GET | /auth/me | ✅ | Get current user |
| PUT | /auth/change-password | ✅ | Change password |
| POST | /auth/forgot-password | — | Request reset |
| POST | /auth/reset-password | — | Reset with token |

## Books
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /books | — | List with filter/search |
| GET | /books/genres | — | All genres |
| GET | /books/suggest?q= | — | Autocomplete |
| GET | /books/:id | — | Single book |
| POST | /books/:id/reviews | ✅ | Add review |

## Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /orders/validate-coupon | ✅ | Validate coupon |
| POST | /orders | ✅ | Place order |
| GET | /orders | ✅ | My orders |
| GET | /orders/:id | ✅ | Single order |
| POST | /orders/:id/cancel | ✅ | Cancel order |
| GET | /orders/:id/invoice | ✅ | Get invoice |

## Wishlist
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /wishlist | ✅ | Get wishlist |
| POST | /wishlist/:bookId | ✅ | Add to wishlist |
| DELETE | /wishlist/:bookId | ✅ | Remove |

## Admin (role: admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/dashboard | Full stats |
| GET/POST | /admin/books | List / Create |
| PUT/DELETE | /admin/books/:id | Update / Delete |
| GET | /admin/inventory | Stock levels |
| PATCH | /admin/inventory/:id/stock | Update stock |
| GET | /admin/orders | All orders |
| PATCH | /admin/orders/:id/status | Update status |
| GET/POST/DELETE | /admin/coupons | Manage coupons |
| GET | /admin/users | All users |
| PATCH | /admin/users/:id/toggle | Enable/disable |
| GET | /admin/subscribers | Email list |
