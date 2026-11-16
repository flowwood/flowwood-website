.PHONY: validate-products check

validate-products:
	@node build/products.mjs

check: validate-products
	@npm run check
