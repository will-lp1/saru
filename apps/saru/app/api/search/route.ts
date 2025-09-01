import { NextRequest, NextResponse } from 'next/server';
import { searchDocuments } from '../document/actions/search';

export async function GET(request: NextRequest) {
  try {
    // Extract query parameter
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    
    // Handle empty query
    if (!query) {
      return NextResponse.json({ results: [] });
    }
    
    // Get optional limit parameter (default is 5 in the search function)
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    
    // Execute the search using the utility function
    const searchResult = await searchDocuments({ 
      query, 
      limit
    });
    
    // Return the search results
    return NextResponse.json(searchResult);
    
  } catch (error) {
    console.error('[Search API] Error:', error);
    
    // Handle different error types
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', results: [] }, 
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Search failed', results: [] }, 
      { status: 500 }
    );
  }
} 