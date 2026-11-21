"use server";

import { updateTag } from "next/cache";
import {
  authorSchema,
  bookIdSchema,
  bookSchema,
  categorySchema,
  deleteSchema,
  selectionSchema,
  type AuthorInput,
  type BookInput,
  type CategoryInput,
  type SelectionInput,
} from "@/features/library/schemas";
import {
  deleteAuthor,
  deleteCategory,
  deleteSelection,
  saveAuthor,
  saveBook,
  saveCategory,
  saveSelection,
  setBookArchived,
} from "@/features/library/service";
import { cacheTags } from "@/lib/cache-tags";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/** Gestion du catalogue. Chaque action exige `books.manage` et rafraîchit le site public. */

export async function saveBookAction(input: BookInput): Promise<ActionResult<{ slug: string }>> {
  return runAction("library.saveBook", async () => {
    await requirePermission("books.manage");
    const book = await saveBook(parseInput(bookSchema, input));
    updateTag(cacheTags.books);
    return { slug: book.slug };
  });
}

export async function setBookArchivedAction(input: {
  id: string;
  archived: boolean;
}): Promise<ActionResult> {
  return runAction("library.archiveBook", async () => {
    await requirePermission("books.manage");
    const { id, archived } = parseInput(bookIdSchema, input);
    await setBookArchived(id, archived);
    updateTag(cacheTags.books);
    return undefined;
  });
}

export async function saveCategoryAction(input: CategoryInput): Promise<ActionResult> {
  return runAction("library.saveCategory", async () => {
    await requirePermission("books.manage");
    await saveCategory(parseInput(categorySchema, input));
    updateTag(cacheTags.books);
    return undefined;
  });
}

export async function deleteCategoryAction(input: { id: string }): Promise<ActionResult> {
  return runAction("library.deleteCategory", async () => {
    await requirePermission("books.manage");
    await deleteCategory(parseInput(deleteSchema, input).id);
    updateTag(cacheTags.books);
    return undefined;
  });
}

export async function saveAuthorAction(input: AuthorInput): Promise<ActionResult> {
  return runAction("library.saveAuthor", async () => {
    await requirePermission("books.manage");
    await saveAuthor(parseInput(authorSchema, input));
    updateTag(cacheTags.books);
    return undefined;
  });
}

export async function deleteAuthorAction(input: { id: string }): Promise<ActionResult> {
  return runAction("library.deleteAuthor", async () => {
    await requirePermission("books.manage");
    await deleteAuthor(parseInput(deleteSchema, input).id);
    updateTag(cacheTags.books);
    return undefined;
  });
}

export async function saveSelectionAction(input: SelectionInput): Promise<ActionResult> {
  return runAction("library.saveSelection", async () => {
    await requirePermission("books.manage");
    await saveSelection(parseInput(selectionSchema, input));
    updateTag(cacheTags.books);
    return undefined;
  });
}

export async function deleteSelectionAction(input: { id: string }): Promise<ActionResult> {
  return runAction("library.deleteSelection", async () => {
    await requirePermission("books.manage");
    await deleteSelection(parseInput(deleteSchema, input).id);
    updateTag(cacheTags.books);
    return undefined;
  });
}
