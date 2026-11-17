CREATE TABLE stock (
  product TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL CHECK (quantity >= 0)
);
