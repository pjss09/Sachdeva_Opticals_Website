// Centralized JS: cart (localStorage) + contact form handling

const CART_KEY = 'optical_cart_v1';

function getCart() {
	try {
		return JSON.parse(localStorage.getItem(CART_KEY)) || [];
	} catch (e) {
		return [];
	}
}

function saveCart(cart) {
	localStorage.setItem(CART_KEY, JSON.stringify(cart));
	renderCart();
}

function addToCart(item) {
	const cart = getCart();
	const existing = cart.find(i => i.id === item.id);
	if (existing) {
		existing.qty += 1;
	} else {
		cart.push(Object.assign({}, item, { qty: 1 }));
	}
	saveCart(cart);
	// Announce to screen readers
	try {
		const live = document.getElementById('a11y-live');
		if (live) {
			live.innerText = `${item.name} added to cart.`;
		}
	} catch (e) {}
}

function removeFromCart(id) {
	const cart = getCart().filter(i => i.id !== id);
	saveCart(cart);
}

function clearCart() {
	localStorage.removeItem(CART_KEY);
	renderCart();
}

function formatPrice(p) {
	return '$' + Number(p).toFixed(2);
}

// Modal helpers: open/close with focus management and keyboard trapping
function modalKeyHandler(e) {
	const modal = document.getElementById('product-modal');
	if (!modal || modal.getAttribute('aria-hidden') === 'true') return;
	if (e.key === 'Escape') {
		closeModal();
		return;
	}
	if (e.key === 'Tab') {
		// simple focus trap
		const focusable = modal.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
		if (!focusable || focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault(); last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault(); first.focus();
		}
	}
}

function openModal() {
	const modal = document.getElementById('product-modal');
	if (!modal) return;
	window.__lastFocusedElement = document.activeElement;
	modal.style.display = 'flex';
	modal.setAttribute('aria-hidden','false');
	const body = modal.querySelector('#modal-body');
	if (body) body.focus();
	document.addEventListener('keydown', modalKeyHandler);
}

function closeModal() {
	const modal = document.getElementById('product-modal');
	if (!modal) return;
	modal.style.display = 'none';
	modal.setAttribute('aria-hidden','true');
	document.removeEventListener('keydown', modalKeyHandler);
	try { if (window.__lastFocusedElement) window.__lastFocusedElement.focus(); } catch (e) {}
}

/* Gallery + magnifier helpers */
function buildGalleryHtml(p) {
	const images = (p.images && p.images.length) ? p.images : [(p.image || 'images/placeholder.png')];
	const thumbs = images.map((src, i) => `<img src="${src}" data-src="${src}" class="${i===0? 'active':''}" alt="Thumbnail ${i+1} for ${p.name||'product'}" tabindex="0" role="button" aria-label="View image ${i+1}">`).join('');
	const main = images[0];
	return `<div class="gallery">
		<div class="gallery-main" style="position:relative">
			<div class="magnifier-lens" style="display:none"></div>
			<img id="gallery-main-img" src="${main}" data-large="${main}" alt="${(p.name||'Product')}" style="width:100%;border-radius:8px;" />
		</div>
		<div class="gallery-thumbs">${thumbs}</div>
	</div>`;
}

function initGalleryInteractions(containerSelector) {
	const cont = (typeof containerSelector === 'string') ? document.querySelector(containerSelector) : containerSelector;
	if (!cont) return;
	const mainImg = cont.querySelector('#gallery-main-img');
	const lens = cont.querySelector('.magnifier-lens');
	const thumbs = cont.querySelectorAll('.gallery-thumbs img');
	const zoom = 2;

	thumbs.forEach(t => t.addEventListener('click', function () {
		thumbs.forEach(x => x.classList.remove('active'));
		this.classList.add('active');
		if (mainImg) {
			mainImg.src = this.dataset.src;
			mainImg.dataset.large = this.dataset.src;
			if (lens) lens.style.backgroundImage = `url('${mainImg.src}')`;
		}
	}));

	// Make thumbnails keyboard-accessible: Enter/Space to activate, arrows to navigate
	thumbs.forEach((t, idx) => t.addEventListener('keydown', function (ev) {
		const key = ev.key;
		if (key === 'Enter' || key === ' ' ) {
			ev.preventDefault();
			t.click();
			return;
		}
		if (key === 'ArrowLeft' || key === 'ArrowUp') {
			ev.preventDefault();
			const prev = thumbs[idx - 1] || thumbs[thumbs.length - 1];
			if (prev) prev.focus();
			return;
		}
		if (key === 'ArrowRight' || key === 'ArrowDown') {
			ev.preventDefault();
			const next = thumbs[idx + 1] || thumbs[0];
			if (next) next.focus();
			return;
		}
	}));

	if (!mainImg || !lens) return;

	// show/hide lens on mouse events
	mainImg.addEventListener('mouseenter', function () {
		lens.style.display = 'block';
		lens.style.backgroundImage = `url('${mainImg.src}')`;
	});
	mainImg.addEventListener('mouseleave', function () { lens.style.display = 'none'; });
	mainImg.addEventListener('mousemove', function (ev) {
		const rect = mainImg.getBoundingClientRect();
		const x = ev.clientX - rect.left;
		const y = ev.clientY - rect.top;
		// keep lens within bounds
		const lx = Math.max(0, Math.min(rect.width, x));
		const ly = Math.max(0, Math.min(rect.height, y));
		const lensW = lens.offsetWidth || 140;
		const lensH = lens.offsetHeight || 140;
		// position lens
		lens.style.left = (lx) + 'px';
		lens.style.top = (ly) + 'px';
		// background sizing and position
		lens.style.backgroundSize = (rect.width * zoom) + 'px ' + (rect.height * zoom) + 'px';
		const bgX = -(lx * zoom - lensW / 2);
		const bgY = -(ly * zoom - lensH / 2);
		lens.style.backgroundPosition = bgX + 'px ' + bgY + 'px';
	});

	// Touch: on tap toggle zoomed image in a simple way
	mainImg.addEventListener('touchstart', function (ev) {
		if (lens.style.display === 'block') { lens.style.display = 'none'; } else { lens.style.display = 'block'; lens.style.backgroundImage = `url('${mainImg.src}')`; }
	});
}

function renderCart() {
	let drawer = document.getElementById('cart-drawer');
	if (!drawer) {
		drawer = document.createElement('div');
		drawer.id = 'cart-drawer';
		document.body.appendChild(drawer);
	}
	const cart = getCart();
	if (cart.length === 0) {
		drawer.innerHTML = `<div class="cart-empty"><strong>Your cart is empty</strong><p style="color:var(--muted)">Add some frames to get started.</p><div style="margin-top:12px"><button class="button" onclick="document.getElementById('product-gallery').scrollIntoView({behavior:'smooth'})">Browse frames</button></div></div>`;
		return;
	}

	let total = 0;
	const itemsHtml = cart.map(i => {
		const line = i.qty * Number(i.price);
		total += line;
		return `<div class="cart-item" data-id="${i.id}"><img src="${i.image||'images/placeholder.png'}" alt="${i.name}"/><div style="flex:1"><strong>${i.name}</strong><div style="color:var(--muted);font-size:0.95rem">${formatPrice(i.price)} each</div><div class="qty-controls" data-id="${i.id}"><button class="qty-decr" data-id="${i.id}" aria-label="Decrease quantity for ${i.name}">−</button><div class="qty" data-id="${i.id}" aria-live="polite">${i.qty}</div><button class="qty-incr" data-id="${i.id}" aria-label="Increase quantity for ${i.name}">+</button></div></div><div style="text-align:right"><div style="font-weight:700">${formatPrice(line)}</div><div style="margin-top:8px"><button class="btn-remove" data-id="${i.id}" style="background:transparent;border:0;color:#f44336" aria-label="Remove ${i.name} from cart">Remove</button></div></div></div>`;
	}).join('');

	drawer.innerHTML = `<div class="cart-grid"><div class="cart-items"><strong>Cart</strong>${itemsHtml}</div><div class="order-summary"><h4>Order Summary</h4><div style="display:flex;justify-content:space-between"><div>Subtotal</div><div id="summary-sub">${formatPrice(total)}</div></div><div style="display:flex;justify-content:space-between;margin-top:6px"><div>Tax</div><div id="summary-tax">${formatPrice((total*0.12))}</div></div><hr><div style="display:flex;justify-content:space-between;font-weight:700"><div>Total</div><div id="summary-total">${formatPrice(total * 1.12)}</div></div><div class="cart-actions"><button id="checkout-btn" class="button btn-primary">Checkout</button><button id="clear-cart" class="button" style="background:#f44336;color:#fff">Clear</button></div></div></div>`;

	// attach quantity handlers
	drawer.querySelectorAll('.qty-incr').forEach(b=> b.addEventListener('click', (e)=>{
		const id = e.target.dataset.id; const c = getCart(); const it = c.find(x=>x.id===id); if (it) { it.qty = (it.qty||1) + 1; saveCart(c); }
	}));
	drawer.querySelectorAll('.qty-decr').forEach(b=> b.addEventListener('click', (e)=>{
		const id = e.target.dataset.id; const c = getCart(); const it = c.find(x=>x.id===id); if (it) { it.qty = Math.max(0, (it.qty||1) - 1); if (it.qty === 0) { const idx = c.findIndex(x=>x.id===id); c.splice(idx,1); } saveCart(c); }
	}));
	drawer.querySelectorAll('.btn-remove').forEach(b=> b.addEventListener('click', (e)=>{ removeFromCart(e.target.dataset.id); }));

	document.getElementById('clear-cart').addEventListener('click', clearCart);
	document.getElementById('checkout-btn').addEventListener('click', showCheckoutForm);

	// update cart-count badge (aria-live) whenever the drawer is rendered
	const cartCountNode = document.getElementById('cart-count');
	if (cartCountNode) {
		const count = getCart().reduce((s,i)=>s + (i.qty||0), 0);
		cartCountNode.innerText = count;
		cartCountNode.setAttribute('aria-live','polite');
	}
}

// --- Wishlist (localStorage) ---
const WISHLIST_KEY = 'optical_wishlist_v1';
function getWishlist() {
	try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; } catch (e) { return []; }
}
function saveWishlist(list) { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); }
function addToWishlist(item) {
	const list = getWishlist();
	if (!list.find(i => i.id === item.id)) {
		list.push(item);
		saveWishlist(list);
		alert(item.name + ' added to wishlist');
	} else alert(item.name + ' is already in your wishlist');
}
function removeFromWishlist(id) {
	const list = getWishlist().filter(i => i.id !== id);
	saveWishlist(list);
	if (document.getElementById('wishlist-container')) renderWishlistPage();
}
function renderWishlistPage() {
	const container = document.getElementById('wishlist-container');
	if (!container) return;
	const list = getWishlist();
	if (list.length === 0) { container.innerHTML = '<p>Your wishlist is empty.</p>'; return; }
	container.innerHTML = list.map(i=>`<div class="wish-item" data-id="${i.id}" style="display:flex;justify-content:space-between;align-items:center;margin:8px 0"><div><img src="${i.image||'images/placeholder.png'}" style="width:64px;height:64px;object-fit:contain;margin-right:8px"><strong>${i.name}</strong><div style="color:#666">${i.price ? '$' + Number(i.price).toFixed(2) : ''}</div></div><div><button class="btn-add-cart" data-id="${i.id}">Add to Cart</button> <button class="btn-remove-wish" data-id="${i.id}" style="background:#f44336;color:#fff">Remove</button></div></div>`).join('');
	document.querySelectorAll('.btn-remove-wish').forEach(b=>b.addEventListener('click', e=>{
		const id = e.target.dataset.id; removeFromWishlist(id);
	}));
	document.querySelectorAll('.btn-add-cart').forEach(b=>b.addEventListener('click', e=>{
		const id = e.target.dataset.id; const item = getWishlist().find(i=>i.id===id); if (item) { addToCart(item); removeFromWishlist(id); }
	}));
}

function showCheckoutForm() {
	const drawer = document.getElementById('cart-drawer');
	const cart = getCart();
	if (cart.length === 0) return alert('Cart is empty');
		const subtotal = cart.reduce((s,i)=> s + i.qty * Number(i.price), 0);
		const tax = +(subtotal * 0.12).toFixed(2);
		const total = +(subtotal + tax).toFixed(2);

		drawer.innerHTML = `<div style="padding:6px"><button id="cancel-checkout" style="float:right;background:transparent;border:0;font-size:18px">✕</button><h3>Checkout</h3></div>
				<div class="cart-grid" style="align-items:start">
					<div>
						<form id="checkout-form">
							<div style="display:flex;gap:8px"><input name="name" placeholder="Full name" required style="flex:1;padding:10px" /><input name="phone" placeholder="Phone" required style="width:140px;padding:10px" /></div>
							<input name="email" placeholder="Email" type="email" required style="width:100%;padding:10px;margin-top:8px" />
							<input name="address" placeholder="Address" required style="width:100%;padding:10px;margin-top:8px" />
							<div style="margin-top:10px"><label>Notes (optional)</label><textarea name="notes" style="width:100%;padding:8px"></textarea></div>
							<div style="margin-top:12px"><button type="submit" class="button btn-primary">Place Order</button> <button type="button" id="cancel-checkout-2" class="button" style="background:#ddd;color:#000">Cancel</button></div>
						</form>
					</div>
					<div class="order-summary">
						<h4>Order Summary</h4>
						<div id="checkout-items" style="max-height:240px;overflow:auto"></div>
						<hr>
						<div style="display:flex;justify-content:space-between"><div>Subtotal</div><div id="co-sub">${formatPrice(subtotal)}</div></div>
						<div style="display:flex;justify-content:space-between;margin-top:6px"><div>Tax</div><div id="co-tax">${formatPrice(tax)}</div></div>
						<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px"><div>Total</div><div id="co-total">${formatPrice(total)}</div></div>
					</div>
				</div>`;

		document.getElementById('cancel-checkout').addEventListener('click', renderCart);
		document.getElementById('cancel-checkout-2').addEventListener('click', renderCart);

		// populate checkout items
		const itemsNode = document.getElementById('checkout-items');
		itemsNode.innerHTML = cart.map(i => `<div style="display:flex;justify-content:space-between;padding:6px 0"><div><strong>${i.name}</strong><div style="color:var(--muted)">${i.qty} × ${formatPrice(i.price)}</div></div><div style="font-weight:700">${formatPrice(i.qty * Number(i.price))}</div></div>`).join('');

		document.getElementById('checkout-form').addEventListener('submit', function (e) {
		e.preventDefault();
		const form = new FormData(e.target);
		const order = {
			id: 'ORD' + Date.now(),
			customer: {
				name: form.get('name'),
				email: form.get('email'),
				address: form.get('address')
			},
			items: getCart(),
			total: getCart().reduce((s,i)=> s + i.qty * Number(i.price), 0),
			date: new Date().toISOString()
		};

		// Try to POST this order to the server; if that fails, fall back to local confirmation.
		(async function () {
			try {
				// First, attempt to create a payment (mock or via Stripe on the server)
					// Improved payment flow: if Stripe publishable key is available, use Stripe Elements
				let paymentResp = null;
				try {
					const cfg = await fetch('/api/config').then(r => r.json()).catch(()=>({}));
					if (cfg && cfg.stripePublishable) {
						// Load Stripe dynamically
						if (!window.Stripe) {
							const s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; document.head.appendChild(s);
							await new Promise(r => s.onload = r);
						}
						const stripe = window.Stripe(cfg.stripePublishable);
						// Create PaymentIntent on the server
						const payRes = await fetch('/api/payments/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, total: order.total }) });
						if (!payRes.ok) throw new Error('Payment creation failed');
						const pi = await payRes.json();
						// Show a simple card input
						drawer.innerHTML = '<strong>Pay with card</strong><div id="card-element"></div><div id="card-errors" role="alert" style="color:#f44336;margin-top:8px"></div><div style="margin-top:8px"><button id="pay-now" style="padding:8px">Pay</button> <button id="cancel-checkout" style="padding:8px">Cancel</button></div>';
						const elements = stripe.elements();
						const card = elements.create('card');
						card.mount('#card-element');
						document.getElementById('cancel-checkout').addEventListener('click', renderCart);
						document.getElementById('pay-now').addEventListener('click', async function () {
							const { error, paymentIntent } = await stripe.confirmCardPayment(pi.clientSecret, { payment_method: { card } });
							if (error) { document.getElementById('card-errors').innerText = error.message || 'Payment failed'; return; }
							paymentResp = { success: true, provider: 'stripe', paymentIntentId: paymentIntent.id };
							// send order to server with payment info
							order.payment = paymentResp;
							const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
							if (res.ok) { const body = await res.json(); const serverOrder = body.order || order; document.getElementById('cart-drawer').innerHTML = `<h3>Order Confirmed</h3><p>Order #${serverOrder.id}</p><p>Your order has been received and will be processed.</p><pre style="white-space:pre-wrap;max-height:200px;overflow:auto">${JSON.stringify(serverOrder, null, 2)}</pre><button id="done-btn" style="margin-top:8px;padding:8px">Done</button>`; document.getElementById('done-btn').addEventListener('click', function () { clearCart(); renderCart(); }); return; } else { document.getElementById('card-errors').innerText = 'Order save failed'; }
						});
						return;
					} else {
						// No Stripe configured; fallback to basic flow
						const payRes = await fetch('/api/payments/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, total: order.total }) });
						if (payRes.ok) paymentResp = await payRes.json();
					}
				} catch (pe) {
					// payments endpoint unreachable or Stripe flow failed — continue to attempt order POST below (fallback)
					console.warn('Payment flow error', pe.message);
				}

				// Attach payment info (if any) to order and POST it to the server
				if (paymentResp) order.payment = paymentResp;
				const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
				if (res.ok) {
					const body = await res.json();
					const serverOrder = body.order || order;
					document.getElementById('cart-drawer').innerHTML = `<h3>Order Confirmed</h3><p>Order #${serverOrder.id}</p><p>Your order has been received and will be processed.</p><pre style="white-space:pre-wrap;max-height:200px;overflow:auto">${JSON.stringify(serverOrder, null, 2)}</pre><button id="done-btn" style="margin-top:8px;padding:8px">Done</button>`;
					document.getElementById('done-btn').addEventListener('click', function () { clearCart(); renderCart(); });
					return;
				}
			} catch (e) {
				// server call failed; fall back to local confirmation below
			}

			// Fallback local confirmation (offline/demo)
			document.getElementById('cart-drawer').innerHTML = `<h3>Order Confirmed (Local)</h3><p>Order #${order.id}</p><p>We could not reach the server — the order is saved locally for demo.</p><pre style="white-space:pre-wrap;max-height:200px;overflow:auto">${JSON.stringify(order, null, 2)}</pre><button id="done-btn" style="margin-top:8px;padding:8px">Done</button>`;
			document.getElementById('done-btn').addEventListener('click', function () { clearCart(); renderCart(); });
			const history = JSON.parse(localStorage.getItem('optical_orders') || '[]');
			history.push(order);
			localStorage.setItem('optical_orders', JSON.stringify(history));
			clearCart();
		})();
	});
}

// Wire up add-to-cart buttons and contact form when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
	// Load products from API and render
	fetch('/api/products').then(r=>r.json()).then(products=>{
		const gallery = document.getElementById('product-gallery');
		if (!gallery) return;
		gallery.innerHTML = products.map(p=>`<div class="product" data-id="${p.id}">
				<div class="product-media">
					<a href="product.html?id=${p.id}"><img src="${p.image}" alt="${p.name}"></a>
					${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
					<button class="quick-view-btn" data-id="${p.id}">Quick view</button>
				</div>
				<div class="product-body">
					<h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
					<div class="rating" data-id="rating-${p.id}"></div>
					<p>${(p.description||'').slice(0,120)}</p>
					<div class="price-row"><div class="price">$${p.price.toFixed(2)}</div><div class="card-actions"><button class="button add-to-cart" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">Add to Cart</button><button class="button add-wish" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-image="${p.image||''}" style="background:#ff9800;color:#fff">♥</button></div></div>
				</div>
			</div>`).join('');
		document.querySelectorAll('.add-to-cart').forEach(btn => {
			btn.addEventListener('click', function () {
				const item = { id: btn.dataset.id, name: btn.dataset.name, price: btn.dataset.price };
				addToCart(item);
				alert(`${item.name} added to cart`);
			});
		});
			document.querySelectorAll('.add-wish').forEach(btn => btn.addEventListener('click', function () {
				const item = { id: btn.dataset.id, name: btn.dataset.name, price: btn.dataset.price, image: btn.dataset.image };
				addToWishlist(item);
			}));

		// fetch reviews for each product to show average rating
		products.forEach(async p => {
			try{
				const resp = await fetch('/api/products/' + encodeURIComponent(p.id) + '/reviews');
				if (!resp.ok) return;
				const list = await resp.json();
				if (!list || list.length === 0) return;
				const avg = list.reduce((s,r)=> s + Number(r.rating||0), 0) / list.length;
				const node = document.querySelector('.rating[data-id="rating-' + p.id + '"]');
				if (node) node.innerText = '★'.repeat(Math.round(avg)) + ' (' + list.length + ')';
			}catch(e){ /* ignore */ }
		});

		// attach quick view handlers
		document.querySelectorAll('.quick-view-btn').forEach(btn=> btn.addEventListener('click', async function(e){
			const id = btn.dataset.id;
			try{
				const res = await fetch('/api/products/' + encodeURIComponent(id));
				const p = await res.json();
				const body = document.getElementById('modal-body');
				// Use gallery HTML
				body.innerHTML = `<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:320px">${buildGalleryHtml(p)}</div><div style="flex:1;min-width:260px"><h3>${p.name}</h3><p class="muted">${p.description||''}</p><p class="price">$${Number(p.price).toFixed(2)}</p><div style="margin-top:12px"><button class="button add-to-cart" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">Add to Cart</button></div></div></div>`;
					openModal();
				// initialize gallery interactions inside modal
				initGalleryInteractions(document.getElementById('modal-body'));
				// reattach add-to-cart inside modal
				document.getElementById('modal-body').querySelectorAll('.add-to-cart').forEach(b=> b.addEventListener('click', function(){ addToCart({ id: this.dataset.id, name: this.dataset.name, price: this.dataset.price }); closeModal(); }));
			}catch(err){ console.warn('quick view failed', err.message); }
		}));
	}).catch(()=>{
		console.warn('Could not load products from API; using static markup.');
	});

	// Contact form handler (keeps previous behavior)
	const contactForm = document.getElementById('contact-form');
	if (contactForm) {
		contactForm.addEventListener('submit', function (e) {
			e.preventDefault();
			alert('Thank you for contacting us! We will get back to you soon.');
			this.reset();
		});
	}

		renderCart();
		// update cart badge
		const cartCountNode = document.getElementById('cart-count');
		if (cartCountNode) cartCountNode.innerText = getCart().reduce((s,i)=>s + (i.qty||0), 0);

		// header search filter
		const search = document.getElementById('search-input');
		if (search) {
			search.addEventListener('input', function () {
				const q = this.value.toLowerCase().trim();
				document.querySelectorAll('.product').forEach(card => {
					const title = card.querySelector('h3')?.innerText?.toLowerCase() || '';
					const desc = card.querySelector('p')?.innerText?.toLowerCase() || '';
					const show = !q || title.includes(q) || desc.includes(q);
					card.style.display = show ? '' : 'none';
				});
			});
		}

	// Mobile menu toggle (overlay)
	const mobileBtn = document.getElementById('mobile-menu-btn');
	if (mobileBtn) {
		mobileBtn.addEventListener('click', ()=>{
			const overlay = document.getElementById('mobile-nav-overlay');
			if (!overlay) return;
			overlay.setAttribute('aria-hidden','false');
			// trap focus lightly by focusing the close button
			const closeBtn = document.getElementById('mobile-nav-close');
			if (closeBtn) closeBtn.focus();
		});
		const mobileClose = document.getElementById('mobile-nav-close');
		if (mobileClose) mobileClose.addEventListener('click', ()=>{
			const overlay = document.getElementById('mobile-nav-overlay');
			if (!overlay) return;
			overlay.setAttribute('aria-hidden','true');
		});
		// close overlay when any mobile nav link is clicked
		const overlay = document.getElementById('mobile-nav-overlay');
		if (overlay) {
			overlay.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> overlay.setAttribute('aria-hidden','true')));
		}
	}

	// Product modal: open when clicking image or title
	function attachProductModalHandlers(){
		document.querySelectorAll('.product img, .product h3').forEach(el=>{
			el.addEventListener('click', (e)=>{
				const card = e.target.closest('.product');
				if (!card) return;
				const name = card.querySelector('h3')?.innerText || '';
				const img = card.querySelector('img')?.src || '';
				const desc = card.querySelector('p')?.innerText || '';
				const price = card.querySelector('.price')?.innerText || '';
				const body = document.getElementById('modal-body');
				if (!body) return;
				// Build a simple gallery for the modal using the card's image as single image
				body.innerHTML = `<div style="display:flex;gap:16px;align-items:flex-start"><div style="flex:1">${buildGalleryHtml({ image: img, images: [img], name })}</div><div style="flex:1"><h3>${name}</h3><p>${desc}</p><p class="price">${price}</p><div style="clear:both;margin-top:12px"><button id="modal-add" class="button">Add to Cart</button></div></div></div>`;
				openModal();
				initGalleryInteractions(document.getElementById('modal-body'));
				const addBtn = document.getElementById('modal-add');
				if (addBtn) addBtn.addEventListener('click', ()=>{
					addToCart({ id: card.querySelector('.add-to-cart')?.dataset.id || Date.now(), name, price: parseFloat((card.querySelector('.add-to-cart')?.dataset.price)||0) });
					closeModal();
				});
			});
		});
	}

	attachProductModalHandlers();
	const modalClose = document.getElementById('modal-close');
	if (modalClose) modalClose.addEventListener('click', ()=> closeModal());
});

// --- Admin product management ---
async function fetchAdminProducts() {
	const token = localStorage.getItem('admin_token');
	if (!token) throw new Error('not-auth');
	const res = await fetch('/api/admin/products', { headers: { 'Authorization': 'Bearer ' + token } });
	if (!res.ok) throw new Error('Failed to fetch admin products');
	return res.json();
}

function renderAdminProductsList(products) {
	const container = document.getElementById('admin-products-container');
	if (!container) return;
	if (!products || products.length === 0) {
		container.innerHTML = '<p>No products. Use the form below to add one.</p>' + productEditorHtml();
		attachAdminEditorEvents();
		return;
	}
	container.innerHTML = `<div style="margin-bottom:12px">${productEditorHtml()}</div><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Name</th><th>Price</th><th>Actions</th></tr></thead><tbody>${products.map(p=>`<tr data-id="${p.id}"><td>${p.name}</td><td style="text-align:center">${formatPrice(p.price)}</td><td style="text-align:center"><button class="admin-edit">Edit</button> <button class="admin-delete" style="background:#f44336;color:#fff">Delete</button></td></tr>`).join('')}</tbody></table>`;
	attachAdminEditorEvents();
	document.querySelectorAll('.admin-edit').forEach(btn => btn.addEventListener('click', (e)=>{
		const id = e.target.closest('tr').dataset.id;
		const token = localStorage.getItem('admin_token');
		fetch('/api/admin/products', { headers: { 'Authorization': 'Bearer ' + token } }).then(r=>r.json()).then(list=>{
			const prod = list.find(x=>x.id===id);
			if (prod) showProductEditor(prod);
		}).catch(()=>alert('Could not load product for edit'));
	}));
	document.querySelectorAll('.admin-delete').forEach(btn => btn.addEventListener('click', (e)=>{
		const id = e.target.closest('tr').dataset.id;
		if (!confirm('Delete product?')) return;
		deleteProduct(id).then(()=>loadAdminProducts()).catch(err=>alert('Delete failed'));
	}));
}

function productEditorHtml() {
	return `
	<form id="product-editor" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
		<input name="id" type="hidden">
		<input name="name" placeholder="Name" required style="flex:2;padding:8px">
		<input name="price" placeholder="Price" required type="number" step="0.01" style="width:120px;padding:8px">
		<input name="image" placeholder="Image URL" style="flex:1;padding:8px">
		<button type="submit" style="padding:8px">Save</button>
	</form>`;
}

function attachAdminEditorEvents() {
	const form = document.getElementById('product-editor');
	if (!form) return;
	form.addEventListener('submit', function (e) {
		e.preventDefault();
		const fd = new FormData(form);
		const payload = { id: fd.get('id') || undefined, name: fd.get('name'), price: Number(fd.get('price')), image: fd.get('image') };
		saveProduct(payload).then(()=>{
			form.reset();
			loadAdminProducts();
		}).catch(err=>alert('Save failed'));
	});
}

function showProductEditor(prod) {
	const form = document.getElementById('product-editor');
	if (!form) return;
	form.id && (form.querySelector('[name="id"]').value = prod.id || '');
	form.querySelector('[name="name"]').value = prod.name || '';
	form.querySelector('[name="price"]').value = prod.price || '';
	form.querySelector('[name="image"]').value = prod.image || '';
}

async function saveProduct(p) {
	const token = localStorage.getItem('admin_token');
	if (!token) throw new Error('not-auth');
	if (p.id) {
		const res = await fetch('/api/admin/products/' + encodeURIComponent(p.id), { method: 'PUT', headers: {'Content-Type':'application/json','Authorization': 'Bearer ' + token }, body: JSON.stringify(p) });
		if (!res.ok) throw new Error('save-failed');
		return res.json();
	} else {
		const res = await fetch('/api/admin/products', { method: 'POST', headers: {'Content-Type':'application/json','Authorization': 'Bearer ' + token }, body: JSON.stringify(p) });
		if (!res.ok) throw new Error('save-failed');
		return res.json();
	}
}

async function deleteProduct(id) {
	const token = localStorage.getItem('admin_token');
	if (!token) throw new Error('not-auth');
	const res = await fetch('/api/admin/products/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
	if (!res.ok) throw new Error('delete-failed');
	return res.json();
}

async function loadAdminProducts() {
	try {
		const list = await fetchAdminProducts();
		renderAdminProductsList(list);
	} catch (e) {
		const container = document.getElementById('admin-products-container');
		if (container) container.innerHTML = '<p>Admin product manager is available after login. Open the login page and store the token as <code>admin_token</code> in localStorage.</p>';
	}
}

// Auto-load admin UI if token present
if (localStorage.getItem('admin_token')) {
	document.addEventListener('DOMContentLoaded', loadAdminProducts);
}

// Admin login form handlers
document.addEventListener('DOMContentLoaded', function(){
	const loginForm = document.getElementById('admin-login-form');
	const logoutBtn = document.getElementById('admin-logout');
	function setLoggedInUI(loggedIn){
		if (!loginForm) return;
		loginForm.querySelector('[name="username"]').style.display = loggedIn ? 'none' : '';
		loginForm.querySelector('[name="password"]').style.display = loggedIn ? 'none' : '';
		loginForm.querySelector('button[type="submit"]').style.display = loggedIn ? 'none' : '';
		if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
	}

	if (localStorage.getItem('admin_token')) {
		setLoggedInUI(true);
		loadAdminProducts();
	}

	if (loginForm) loginForm.addEventListener('submit', async function(e){
		e.preventDefault();
		const u = loginForm.querySelector('[name="username"]').value;
		const p = loginForm.querySelector('[name="password"]').value;
		try {
			const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u, password: p }) });
			if (!res.ok) throw new Error('Login failed');
			const json = await res.json();
			localStorage.setItem('admin_token', json.token);
			setLoggedInUI(true);
			loadAdminProducts();
			alert('Logged in as admin');
		} catch (err) {
			alert('Login failed: ' + err.message);
		}
	});

	if (logoutBtn) logoutBtn.addEventListener('click', function(){
		localStorage.removeItem('admin_token');
		setLoggedInUI(false);
		document.getElementById('admin-products-container').innerHTML = '<p>Logged out.</p>';
	});
});