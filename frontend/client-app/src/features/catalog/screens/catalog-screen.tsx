import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronRight,
  LayoutGrid,
  Package,
  Search,
  Shapes,
} from "lucide-react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CategoryFilterButton } from "@/components/shared/category-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { LoadingState } from "@/components/shared/loading-state";
import { ModuleHeader } from "@/components/shared/module-header";
import { ProductImage } from "@/components/shared/product-image";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn, formatCurrency } from "@/lib/utils";
import { listCategories } from "@/services/category.service";
import { listProductsPage } from "@/services/product.service";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";

const PAGE_SIZE = 20;
const SCREEN_PADDING = 16;
const GRID_GAP = 12;

type CatalogMode = "products" | "categories";

type CatalogItem =
  | { kind: "product"; product: Product }
  | { kind: "category"; category: Category };

type CatalogNavigation = NativeStackNavigationProp<{
  CatalogProductDetail: { productId: string };
}>;

type CatalogRoute = RouteProp<
  {
    Catalog:
      | {
          categoryId?: string;
          requestId?: number;
        }
      | undefined;
  },
  "Catalog"
>;

function ProductGridSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={{ width: cardWidth }}>
          <Card padded={false} className="overflow-hidden border-border">
            <Skeleton className="w-full rounded-none" style={{ aspectRatio: 1 }} />
            <View className="gap-2 p-3">
              <Skeleton className="h-3 w-16 rounded-sm" />
              <Skeleton className="h-4 w-full rounded-sm" />
              <Skeleton className="h-4 w-4/5 rounded-sm" />
              <Skeleton className="mt-1 h-4 w-24 rounded-sm" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </View>
          </Card>
        </View>
      ))}
    </View>
  );
}

export function CatalogScreen() {
  const navigation = useNavigation<CatalogNavigation>();
  const route = useRoute<CatalogRoute>();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - SCREEN_PADDING * 2 - GRID_GAP) / 2);

  const [mode, setMode] = useState<CatalogMode>("products");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  useEffect(() => {
    const requestedCategoryId = route.params?.categoryId;
    if (!requestedCategoryId) return;

    const timer = setTimeout(() => {
      setMode("products");
      setQuery("");
      setDebouncedQuery("");
      setCategoryId(requestedCategoryId);
    }, 0);
    return () => clearTimeout(timer);
  }, [route.params?.categoryId, route.params?.requestId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const list = await listCategories();
      setCategories(list);
    } catch {
      setCategoriesError("Failed to load categories.");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer out of the effect body so the synchronous loading state is not a
    // cascading render (React Compiler lint rule).
    const timer = setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCategories]);

  const loadProducts = useCallback(
    async (options: { append?: boolean; refresh?: boolean } = {}) => {
      const append = options.append ?? false;
      const targetPage = append ? page + 1 : 1;
      const id = ++requestId.current;

      if (append) {
        setLoadingMore(true);
      } else if (!options.refresh) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await listProductsPage({
          page: targetPage,
          pageSize: PAGE_SIZE,
          search: debouncedQuery || undefined,
          categoryId: categoryId === "all" ? undefined : categoryId,
          status: "active",
          sortBy: "name",
          sortOrder: "asc",
        });

        // A slower, older request must not overwrite a newer search.
        if (id !== requestId.current) return;

        setProducts((current) => {
          if (!append) return result.products;
          const seen = new Set(current.map((p) => p.id));
          return [
            ...current,
            ...result.products.filter((p) => !seen.has(p.id)),
          ];
        });
        setTotal(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
      } catch {
        if (id === requestId.current) {
          setError("Failed to load products. Check your connection.");
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [categoryId, debouncedQuery, page],
  );

  // Reload from the first page whenever filters change.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, debouncedQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([loadProducts({ refresh: true }), loadCategories()]);
  }, [loadCategories, loadProducts]);

  const onEndReached = useCallback(() => {
    if (
      mode !== "products" ||
      loading ||
      loadingMore ||
      error ||
      page >= totalPages
    ) {
      return;
    }
    void loadProducts({ append: true });
  }, [error, loadProducts, loading, loadingMore, mode, page, totalPages]);

  const categoryNames = useMemo(
    () => categories.map((category) => category.name),
    [categories],
  );

  const selectedCategoryName =
    categories.find((category) => category.id === categoryId)?.name ?? "all";

  const onCategoryFilterChange = (name: string) => {
    const match = categories.find((category) => category.name === name);
    setCategoryId(match?.id ?? "all");
  };

  const openCategory = (category: Category) => {
    setCategoryId(category.id);
    setMode("products");
  };

  const hasFilters = Boolean(debouncedQuery) || categoryId !== "all";

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setCategoryId("all");
  };

  const data: CatalogItem[] = useMemo(() => {
    if (mode === "categories") {
      return categories.map((category) => ({ kind: "category", category }));
    }
    return products.map((product) => ({ kind: "product", product }));
  }, [categories, mode, products]);

  const renderProduct = (product: Product) => {
    const outOfStock = product.stockQuantity <= 0;
    const lowStock = !outOfStock && product.stockQuantity <= 5;

    return (
      <Card
        padded={false}
        className="overflow-hidden rounded-md border border-border bg-card"
      >
        <Pressable
          onPress={() =>
            navigation.navigate("CatalogProductDetail", {
              productId: product.id,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`View ${product.name}`}
          className="active:opacity-90"
        >
          <View className="relative bg-secondary">
            <ProductImage
              source={product.image}
              className="w-full border-b border-border"
              style={{ aspectRatio: 1 }}
              iconSize={28}
            />
            <View className="absolute right-2 top-2">
              <FavoriteButton productId={product.id} />
            </View>
            {outOfStock ? (
              <View className="absolute inset-0 items-center justify-center bg-white/55">
                <View className="rounded-sm border border-border bg-background px-2.5 py-1">
                  <Text className="text-[11px] font-semibold text-foreground">
                    Out of stock
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View className="p-3">
            <Text
              numberOfLines={1}
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {product.categoryName || "Uncategorized"}
            </Text>

            <Text
              numberOfLines={2}
              className="mt-1 min-h-[40px] text-[14px] font-semibold leading-5 text-foreground"
            >
              {product.name}
            </Text>

            <View className="mt-2 flex-row items-end justify-between gap-2">
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-primary">
                  {formatCurrency(product.sellingPrice)}
                </Text>
                <Text
                  numberOfLines={1}
                  className="mt-0.5 text-[12px] text-muted-foreground"
                >
                  per {product.unit || "unit"}
                </Text>
              </View>
              <ChevronRight size={16} color="#9CA3AF" />
            </View>

            <View className="mt-2.5 border-t border-border pt-2.5">
              <Text
                numberOfLines={1}
                className={cn(
                  "text-[12px] font-medium",
                  outOfStock
                    ? "text-danger"
                    : lowStock
                      ? "text-warning"
                      : "text-muted-foreground"
                )}
              >
                {outOfStock
                  ? "Out of stock"
                  : `${product.stockQuantity} in stock`}
              </Text>
            </View>
          </View>
        </Pressable>
      </Card>
    );
  };

  const renderCategory = (category: Category) => (
    <Pressable
      onPress={() => openCategory(category)}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${category.name}`}
      className="active:opacity-80"
    >
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Package size={20} color="#16A34A" />
          </View>
          <View className="flex-1 pr-1">
            <Text weight="semibold" numberOfLines={1}>
              {category.name}
            </Text>
            {category.description ? (
              <Text
                variant="small"
                tone="muted"
                numberOfLines={1}
                className="mt-0.5"
              >
                {category.description}
              </Text>
            ) : null}
            <Text variant="small" tone="primary" className="mt-1">
              {category.productCount}{" "}
              {category.productCount === 1 ? "product" : "products"}
            </Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </View>
      </Card>
    </Pressable>
  );

  const header = (
    <View className="pb-4">
      <ModuleHeader
        eyebrow="Browse"
        title="Catalog"
        subtitle="Browse products by category and view details."
        action={
          <View className="rounded-md border border-border bg-secondary px-3 py-1.5">
            <Text className="text-[12px] font-semibold text-foreground">
              {mode === "products"
                ? `${total} ${total === 1 ? "Product" : "Products"}`
                : `${categories.length} ${
                    categories.length === 1 ? "Category" : "Categories"
                  }`}
            </Text>
          </View>
        }
        className="mb-4"
      />

      <View className="flex-row rounded-md border border-border bg-secondary p-1">
        <Pressable
          onPress={() => setMode("products")}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === "products" }}
          accessibilityLabel="Products"
          className={cn(
            "h-10 flex-1 flex-row items-center justify-center gap-2 rounded-sm border",
            mode === "products"
              ? "border-border bg-background"
              : "border-transparent bg-transparent"
          )}
        >
          <LayoutGrid
            size={16}
            color={mode === "products" ? "#16A34A" : "#64748B"}
            strokeWidth={1.8}
          />
          <Text
            className={cn(
              "text-[13px] font-semibold",
              mode === "products" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Products
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("categories")}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === "categories" }}
          accessibilityLabel="Categories"
          className={cn(
            "h-10 flex-1 flex-row items-center justify-center gap-2 rounded-sm border",
            mode === "categories"
              ? "border-border bg-background"
              : "border-transparent bg-transparent"
          )}
        >
          <Shapes
            size={16}
            color={mode === "categories" ? "#16A34A" : "#64748B"}
            strokeWidth={1.8}
          />
          <Text
            className={cn(
              "text-[13px] font-semibold",
              mode === "categories" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Categories
          </Text>
        </Pressable>
      </View>

      {mode === "products" ? (
        <View className="mt-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Input
              size="control"
              containerClassName="flex-1"
              value={query}
              onChangeText={setQuery}
              placeholder="Search products"
              accessibilityLabel="Search products"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              leftIcon={<Search size={18} color="#6B7280" strokeWidth={1.8} />}
            />
            <CategoryFilterButton
              categories={categoryNames}
              value={selectedCategoryName}
              onChange={onCategoryFilterChange}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-[12px] text-muted-foreground">
              {hasFilters
                ? `${total} ${total === 1 ? "result" : "results"}`
                : "All available products"}
            </Text>
            {hasFilters ? (
              <Pressable
                onPress={clearFilters}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
                className="min-h-[32px] justify-center px-1 active:opacity-70"
              >
                <Text className="text-[12px] font-semibold text-primary">
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View className="mt-4">
          <Text className="text-[12px] text-muted-foreground">
            Browse products by category
          </Text>
        </View>
      )}
    </View>
  );

  const emptyComponent = (() => {
    if (mode === "categories") {
      return categoriesLoading ? (
        <LoadingState label="Loading categories..." />
      ) : categoriesError ? (
        <ErrorState
          description={categoriesError}
          onRetry={() => void loadCategories()}
        />
      ) : (
        <EmptyState
          icon={<Shapes size={24} color="#64748B" />}
          title="No categories yet"
          description="Categories will appear here once products are organised."
        />
      );
    }

    if (loading) return <ProductGridSkeleton cardWidth={cardWidth} />;
    if (error) {
      return (
        <ErrorState description={error} onRetry={() => void loadProducts()} />
      );
    }

    return (
      <EmptyState
        icon={<Package size={24} color="#64748B" />}
        title="No products found"
        description={
          hasFilters
            ? "Try a different search term or category."
            : "There are no products available right now."
        }
        actionLabel={hasFilters ? "Clear filters" : undefined}
        onAction={hasFilters ? clearFilters : undefined}
      />
    );
  })();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <FlatList
        key={mode}
        data={data}
        keyExtractor={(item) =>
          item.kind === "product" ? item.product.id : item.category.id
        }
        numColumns={mode === "products" ? 2 : 1}
        columnWrapperStyle={
          mode === "products" ? { gap: GRID_GAP } : undefined
        }
        contentContainerStyle={{
          padding: SCREEN_PADDING,
          paddingBottom: 28,
          gap: GRID_GAP,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#16A34A"
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={
          mode === "products" && products.length > 0 ? (
            <View className="items-center py-4">
              {loadingMore ? (
                <ActivityIndicator color="#16A34A" />
              ) : page >= totalPages ? (
                <Text className="text-[12px] text-muted-foreground">
                  Showing all {total} {total === 1 ? "product" : "products"}
                </Text>
              ) : null}
            </View>
          ) : undefined
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) =>
          item.kind === "product" ? (
            <View style={{ width: cardWidth }}>{renderProduct(item.product)}</View>
          ) : (
            renderCategory(item.category)
          )
        }
      />
    </SafeAreaView>
  );
}
