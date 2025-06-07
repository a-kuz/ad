import { connectToDatabase } from '../lib/connectToDatabase';
import path from 'path';
import fs from 'fs';

async function fixScreenshotsDirs() {
  console.log('Starting to fix screenshots_dir values...');
  
  const { db } = await connectToDatabase();
  
  // Get all analyses without screenshots_dir
  const analyses = await db.all(`
    SELECT ca.id, ca.file_pair_id, ca.created_at
    FROM comprehensive_analyses ca
    WHERE ca.screenshots_dir IS NULL OR ca.screenshots_dir = ''
  `);
  
  console.log(`Found ${analyses.length} analyses without screenshots_dir`);
  
  let updatedCount = 0;
  let deletedCount = 0;
  
  for (const analysis of analyses) {
    const { id, file_pair_id, created_at } = analysis;
    
    // Check if the file pair exists
    const filePair = await db.get(`
      SELECT session_id FROM file_pairs WHERE id = ?
    `, [file_pair_id]);
    
    if (!filePair) {
      console.log(`File pair ${file_pair_id} doesn't exist. Deleting orphaned analysis ${id}`);
      
      try {
        await db.run(`DELETE FROM comprehensive_analyses WHERE id = ?`, [id]);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting orphaned analysis ${id}:`, error);
      }
      
      continue;
    }
    
    const session_id = filePair.session_id;
    
    // Find screenshots directory
    const screenshotsBasePath = path.join(process.cwd(), 'public', 'uploads', session_id, 'screenshots');
    
    if (!fs.existsSync(screenshotsBasePath)) {
      console.log(`No screenshots directory found for session: ${session_id}, file pair: ${file_pair_id}`);
      continue;
    }
    
    // Find most relevant screenshots directory based on creation time or file_pair_id
    const screenshotDirs = fs.readdirSync(screenshotsBasePath)
      .map(dir => path.join(screenshotsBasePath, dir))
      .filter(dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory())
      .map(dir => ({
        path: dir,
        name: path.basename(dir),
        mtime: fs.statSync(dir).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (screenshotDirs.length === 0) {
      console.log(`No screenshot subdirectories found for session: ${session_id}, file pair: ${file_pair_id}`);
      continue;
    }
    
    // Use the most recent directory or one that might match file_pair_id
    let selectedDir = screenshotDirs[0];
    const analysisCreationTime = new Date(created_at).getTime();
    let smallestTimeDiff = Math.abs(analysisCreationTime - selectedDir.mtime);
    
    for (const dir of screenshotDirs) {
      const timeDiff = Math.abs(analysisCreationTime - dir.mtime);
      if (timeDiff < smallestTimeDiff) {
        smallestTimeDiff = timeDiff;
        selectedDir = dir;
      }
      // If directory name includes file_pair_id, prioritize it
      if (dir.name.includes(file_pair_id)) {
        selectedDir = dir;
        break;
      }
    }
    
    const dirName = selectedDir.name;
    
    try {
      // Update the database record
      await db.run(`
        UPDATE comprehensive_analyses
        SET screenshots_dir = ?
        WHERE id = ?
      `, [dirName, id]);
      
      console.log(`Updated screenshots_dir to ${dirName} for analysis: ${id}, file pair: ${file_pair_id}`);
      updatedCount++;
      
      // Also try to update the visual_analysis JSON if it exists
      try {
        const visualAnalysisRecord = await db.get(`
          SELECT visual_analysis FROM comprehensive_analyses WHERE id = ?
        `, [id]);
        
        if (visualAnalysisRecord && visualAnalysisRecord.visual_analysis) {
          const visualAnalysis = JSON.parse(visualAnalysisRecord.visual_analysis);
          visualAnalysis.screenshotsDir = dirName;
          
          await db.run(`
            UPDATE comprehensive_analyses
            SET visual_analysis = ?
            WHERE id = ?
          `, [JSON.stringify(visualAnalysis), id]);
          
          console.log(`Updated visual_analysis JSON with screenshotsDir for analysis: ${id}`);
        }
      } catch (e) {
        console.log(`Could not update visual_analysis JSON for analysis: ${id}`, e);
      }
    } catch (error) {
      console.error(`Error updating screenshots_dir for analysis: ${id}`, error);
    }
  }
  
  console.log(`Successfully updated ${updatedCount} out of ${analyses.length} analyses`);
  console.log(`Deleted ${deletedCount} orphaned analyses`);
}

fixScreenshotsDirs().catch(console.error); 